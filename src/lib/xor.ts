/**
 * Xor0 game engine — the single source of truth for game logic on the client.
 * Mirrors the rules in xor0_instructions.md (and the SQL `claim_group` RPC).
 *
 * A card is a 6-bit integer 1..63 equal to the sum of its colored dots.
 * A valid "XORO!" group is any subset of >= 3 face-up cards whose values XOR to 0.
 */

export type CardValue = number; // 1..63

/** The six dot colors, each mapped to a power of two (spec §2). */
export const COLORS = ['orange', 'blue', 'green', 'yellow', 'teal', 'red'] as const;
export type Color = (typeof COLORS)[number];

/** Bit value -> color. Position/layout for rendering lives in cards.ts. */
export const BIT_COLOR: Record<number, Color> = {
  1: 'orange',
  2: 'blue',
  4: 'green',
  8: 'yellow',
  16: 'teal',
  32: 'red',
};

export const ALL_BITS = [1, 2, 4, 8, 16, 32] as const;

/** Number of set bits = number of dots on a card. */
export function popcount(x: number): number {
  let count = 0;
  while (x) {
    x &= x - 1;
    count++;
  }
  return count;
}

/** The bit values set on a card, low to high. */
export function bitsOf(value: CardValue): number[] {
  return ALL_BITS.filter((b) => (value & b) !== 0);
}

/** XOR of a group of card values. Zero iff every color appears an even number of times. */
export function xorOfGroup(values: readonly CardValue[]): number {
  return values.reduce((acc, v) => acc ^ v, 0);
}

/**
 * A set of card values is a valid Xor0 group iff:
 *  - it has at least 3 cards (spec §4: no empty/duplicate cards exist),
 *  - the values are distinct (the real deck has no duplicates), and
 *  - their XOR is 0.
 */
export function isValidGroup(values: readonly CardValue[]): boolean {
  if (values.length < 3) return false;
  if (new Set(values).size !== values.length) return false;
  return xorOfGroup(values) === 0;
}

/**
 * Find the best valid group on a table by exhaustive search (table is <= 7 cards).
 * Selection rule (spec §6): most cards, ties broken by most total dots.
 * Returns the winning subset, or null if no valid group exists.
 */
export function bestGroup(table: readonly CardValue[]): CardValue[] | null {
  let best: { cards: number; dots: number; group: CardValue[] } | null = null;

  const n = table.length;
  // Enumerate non-empty subsets via bitmask; keep those of size >= 3 that XOR to 0.
  for (let mask = 1; mask < 1 << n; mask++) {
    if (popcount(mask) < 3) continue;
    let xor = 0;
    let dots = 0;
    const group: CardValue[] = [];
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        const v = table[i];
        xor ^= v;
        dots += popcount(v);
        group.push(v);
      }
    }
    if (xor !== 0) continue;
    if (
      best === null ||
      group.length > best.cards ||
      (group.length === best.cards && dots > best.dots)
    ) {
      best = { cards: group.length, dots, group };
    }
  }

  return best ? best.group : null;
}

/** Does the table contain any valid group at all? */
export function hasValidGroup(table: readonly CardValue[]): boolean {
  return bestGroup(table) !== null;
}

// ---------------------------------------------------------------------------
// Difficulty configuration (spec §8)
// ---------------------------------------------------------------------------

export type Difficulty = 'easy' | 'medium' | 'normal' | 'master';

export interface DifficultyConfig {
  /** Bitmask of active colors. Deck = every value 1..activeMask. */
  activeMask: number;
  /** Number of cards face up on the table. */
  tableSize: number;
  /** Total cards in the deck for this difficulty. */
  deckSize: number;
  label: string;
}

export const DIFFICULTY: Record<Difficulty, DifficultyConfig> = {
  // bits 1,2,4 -> values 1..7
  easy: { activeMask: 7, tableSize: 4, deckSize: 7, label: 'Easy' },
  // bits 1,2,4,8 -> values 1..15
  medium: { activeMask: 15, tableSize: 5, deckSize: 15, label: 'Medium' },
  // bits 1,2,4,8,16 -> values 1..31
  normal: { activeMask: 31, tableSize: 6, deckSize: 31, label: 'Normal' },
  // full deck -> values 1..63
  master: { activeMask: 63, tableSize: 7, deckSize: 63, label: 'Master' },
};

/** All card values for a difficulty, in order (every subset of the active colors). */
export function buildDeck(difficulty: Difficulty): CardValue[] {
  const { activeMask } = DIFFICULTY[difficulty];
  const deck: CardValue[] = [];
  for (let v = 1; v <= activeMask; v++) deck.push(v);
  return deck;
}

/**
 * Fisher-Yates shuffle. Optionally seeded for reproducible games/tests
 * (mulberry32 PRNG). Returns a new array; does not mutate the input.
 */
export function shuffle<T>(input: readonly T[], seed?: number): T[] {
  const arr = input.slice();
  const rng = seed === undefined ? Math.random : mulberry32(seed);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
