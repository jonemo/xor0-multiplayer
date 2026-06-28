/**
 * Solo timed Xor0 — a pure, framework-agnostic game-state module.
 *
 * Single player races the clock: clear valid XORO groups off the table until the
 * deck is exhausted and no group remains. Reuses the shared engine (xor.ts).
 *
 * Deadlock avoidance: a randomly dealt table can contain no valid group while the
 * deck still has cards, and the table only changes on a claim. To guarantee there
 * is always a move, we draw EXTRA cards onto the table until a valid group exists
 * (or the deck runs out) — same approach the game "Set" uses. After a claim we
 * refill back toward the configured table size first, then top up if needed.
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

export type ClaimResult = 'ok' | 'invalid' | 'not-on-table' | 'not-playing';

export interface SoloState {
  difficulty: Difficulty;
  deck: CardValue[];
  /** Index of the next card to draw from `deck`. */
  deckPointer: number;
  /** Face-up cards. At least tableSize until the deck runs low; may exceed it. */
  table: CardValue[];
  collected: CardValue[];
  status: 'playing' | 'over';
  startedAt: number;
  finishedAt: number | null;
  /** True once the player has revealed a hint — exempts the run from leaderboards. */
  hintUsed: boolean;
}

export interface SoloScore {
  cards: number;
  dots: number;
  timeMs: number;
  difficulty: Difficulty;
}

function deckRemaining(s: SoloState): number {
  return s.deck.length - s.deckPointer;
}

/**
 * Draw cards onto the table until (a) it has at least tableSize cards and
 * (b) a valid group exists — or the deck is empty. Mutates and returns `s`.
 * Sets status to 'over' if the deck empties with no group left.
 */
function ensurePlayable(s: SoloState, now: number): SoloState {
  const tableSize = DIFFICULTY[s.difficulty].tableSize;
  // First, refill toward the configured table size.
  while (s.table.length < tableSize && deckRemaining(s) > 0) {
    s.table.push(s.deck[s.deckPointer++]);
  }
  // Then add extra cards only if there is still no valid group.
  while (!hasValidGroup(s.table) && deckRemaining(s) > 0) {
    s.table.push(s.deck[s.deckPointer++]);
  }
  if (deckRemaining(s) === 0) {
    s.status = 'over';
    s.finishedAt = now;
  }
  return s;
}

/** Create and deal a new solo game. `seed` makes the deal reproducible (tests). */
export function createSoloGame(
  difficulty: Difficulty,
  seed?: number,
  now: number = Date.now(),
): SoloState {
  const state: SoloState = {
    difficulty,
    deck: shuffle(buildDeck(difficulty), seed),
    deckPointer: 0,
    table: [],
    collected: [],
    status: 'playing',
    startedAt: now,
    finishedAt: null,
    hintUsed: false,
  };
  return ensurePlayable(state, now);
}

/**
 * Attempt to claim a group. Returns a new state plus a result code.
 * In solo there is no opponent, so an invalid claim is simply rejected (no
 * penalty); UIs should only offer "XORO!" when the selection is already valid.
 */
export function attemptClaim(
  state: SoloState,
  values: readonly CardValue[],
  now: number = Date.now(),
): { state: SoloState; result: ClaimResult } {
  if (state.status !== 'playing') return { state, result: 'not-playing' };
  if (!isValidGroup(values)) return { state, result: 'invalid' };

  const onTable = new Set(state.table);
  if (!values.every((v) => onTable.has(v))) {
    return { state, result: 'not-on-table' };
  }

  const claimed = new Set(values);
  const next: SoloState = {
    ...state,
    table: state.table.filter((v) => !claimed.has(v)),
    collected: [...state.collected, ...values],
  };
  ensurePlayable(next, now);
  return { state: next, result: 'ok' };
}

/** A hint: the best group currently on the table (or null). */
export function soloHint(state: SoloState): CardValue[] | null {
  return bestGroup(state.table);
}

export function scoreOf(state: SoloState, now: number = Date.now()): SoloScore {
  const end = state.finishedAt ?? now;
  return {
    cards: state.collected.length,
    dots: state.collected.reduce((sum, v) => sum + popcount(v), 0),
    timeMs: end - state.startedAt,
    difficulty: state.difficulty,
  };
}
