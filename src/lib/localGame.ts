/**
 * Local (offline) multiplayer: one human plus AI bots sharing a table, played
 * entirely in the browser. Same rules and table mechanics as the online game
 * (src/lib/solo.ts / the SQL claim_group RPC), but authoritative in-memory so it
 * needs no network. The hook (useLocalGame) drives bot reaction timing; this
 * module is the pure, testable state.
 */
import {
  bestGroup,
  buildDeck,
  hasValidGroup,
  isValidGroup,
  popcount,
  shuffle,
  DIFFICULTY,
  type CardValue,
  type Difficulty,
} from './xor';

export type LocalClaimResult = 'claimed' | 'claimed_final' | 'too_slow' | 'invalid' | 'not-playing';

export interface LocalPlayer {
  id: string;
  name: string;
  isAI: boolean;
  /** Bot: base time (ms) to "spot and grab" a set; ignored for the human. */
  baseMs: number;
  /** Bot: chance (0..1) of not spotting a set on a given look (then it looks again). */
  missChance: number;
  cards: CardValue[];
  cardCount: number;
  dotCount: number;
  status: 'active' | 'paused';
}

export interface LocalState {
  difficulty: Difficulty;
  deck: CardValue[];
  deckPointer: number;
  table: CardValue[];
  players: LocalPlayer[];
  status: 'playing' | 'over';
  winnerId: string | null;
  startedAt: number;
  finishedAt: number | null;
}

export interface BotSpec {
  name: string;
  baseMs: number;
  missChance: number;
}

export const HUMAN_ID = 'you';

function deckRemaining(s: LocalState): number {
  return s.deck.length - s.deckPointer;
}

/** Refill toward the table size, then add extras until a group exists (or deck empties). */
function ensurePlayable(s: LocalState, now: number): void {
  const tableSize = DIFFICULTY[s.difficulty].tableSize;
  while (s.table.length < tableSize && deckRemaining(s) > 0) {
    s.table.push(s.deck[s.deckPointer++]);
  }
  while (!hasValidGroup(s.table) && deckRemaining(s) > 0) {
    s.table.push(s.deck[s.deckPointer++]);
  }
  if (deckRemaining(s) === 0) {
    s.status = 'over';
    s.finishedAt = now;
    s.winnerId = winnerOf(s);
  }
}

export function createLocalGame(
  difficulty: Difficulty,
  bots: BotSpec[],
  seed?: number,
  now: number = Date.now(),
): LocalState {
  const players: LocalPlayer[] = [
    mkPlayer(HUMAN_ID, 'You', false, 0, 0),
    ...bots.map((b, i) => mkPlayer(`ai${i}`, b.name, true, b.baseMs, b.missChance)),
  ];
  const state: LocalState = {
    difficulty,
    deck: shuffle(buildDeck(difficulty), seed),
    deckPointer: 0,
    table: [],
    players,
    status: 'playing',
    winnerId: null,
    startedAt: now,
    finishedAt: null,
  };
  ensurePlayable(state, now);
  return state;
}

function mkPlayer(
  id: string,
  name: string,
  isAI: boolean,
  baseMs: number,
  missChance: number,
): LocalPlayer {
  return { id, name, isAI, baseMs, missChance, cards: [], cardCount: 0, dotCount: 0, status: 'active' };
}

/**
 * Attempt a claim by a player. Returns a new state + result. Mirrors the online
 * claim_group: wrong math pauses the claimer; a valid group whose cards are gone
 * is "too_slow" (no penalty); a good claim awards cards, replenishes, and
 * un-pauses everyone.
 */
export function claimLocal(
  state: LocalState,
  playerId: string,
  values: readonly CardValue[],
  now: number = Date.now(),
): { state: LocalState; result: LocalClaimResult } {
  if (state.status !== 'playing') return { state, result: 'not-playing' };
  const idx = state.players.findIndex((p) => p.id === playerId);
  if (idx < 0) return { state, result: 'not-playing' };

  const onTable = new Set(state.table);
  const present = values.every((v) => onTable.has(v));

  if (!isValidGroup(values)) {
    // Wrong math -> penalty (pause until the next valid claim).
    const next = cloneWith(state, (s) => {
      s.players[idx] = { ...s.players[idx], status: 'paused' };
    });
    return { state: next, result: 'invalid' };
  }
  if (!present) {
    return { state, result: 'too_slow' };
  }

  const claimed = new Set(values);
  const dots = values.reduce((sum, v) => sum + popcount(v), 0);
  const next = cloneWith(state, (s) => {
    s.table = s.table.filter((v) => !claimed.has(v));
    const p = s.players[idx];
    s.players[idx] = {
      ...p,
      cards: [...p.cards, ...values],
      cardCount: p.cardCount + values.length,
      dotCount: p.dotCount + dots,
    };
    // A valid claim clears everyone's penalty.
    s.players = s.players.map((pl) => (pl.status === 'paused' ? { ...pl, status: 'active' } : pl));
    ensurePlayable(s, now);
  });

  return { state: next, result: next.status === 'over' ? 'claimed_final' : 'claimed' };
}

/** The best group an active bot would claim right now (or null). */
export function botMove(state: LocalState, playerId: string): CardValue[] | null {
  const p = state.players.find((pl) => pl.id === playerId);
  if (!p || p.status !== 'active' || state.status !== 'playing') return null;
  return bestGroup(state.table);
}

export function winnerOf(state: LocalState): string | null {
  const ranked = [...state.players].sort(
    (a, b) => b.cardCount - a.cardCount || b.dotCount - a.dotCount,
  );
  return ranked[0]?.id ?? null;
}

// Shallow-clone the state, run a mutator on the copy, return it.
function cloneWith(state: LocalState, mutate: (s: LocalState) => void): LocalState {
  const copy: LocalState = {
    ...state,
    deck: state.deck,
    table: state.table.slice(),
    players: state.players.map((p) => ({ ...p })),
  };
  mutate(copy);
  return copy;
}
