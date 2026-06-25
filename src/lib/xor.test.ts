import { describe, it, expect } from 'vitest';
import {
  popcount,
  bitsOf,
  xorOfGroup,
  isValidGroup,
  bestGroup,
  hasValidGroup,
  buildDeck,
  shuffle,
  DIFFICULTY,
  type Difficulty,
} from './xor';

describe('popcount / bitsOf', () => {
  it('counts dots', () => {
    expect(popcount(0)).toBe(0);
    expect(popcount(19)).toBe(3); // 1+2+16 -> 010011
    expect(popcount(63)).toBe(6);
  });
  it('decomposes a card into bits', () => {
    expect(bitsOf(19)).toEqual([1, 2, 16]);
    expect(bitsOf(63)).toEqual([1, 2, 4, 8, 16, 32]);
  });
});

describe('xorOfGroup / isValidGroup (spec §10 worked examples)', () => {
  it('valid 3-card group: 3 ^ 6 ^ 5 == 0', () => {
    expect(xorOfGroup([3, 6, 5])).toBe(0);
    expect(isValidGroup([3, 6, 5])).toBe(true);
  });

  it('invalid group: 3 ^ 6 ^ 16 == 21', () => {
    expect(xorOfGroup([3, 6, 16])).toBe(21);
    expect(isValidGroup([3, 6, 16])).toBe(false);
  });

  it('rejects groups smaller than 3 (no pairs, no singletons)', () => {
    expect(isValidGroup([])).toBe(false);
    expect(isValidGroup([5])).toBe(false);
    expect(isValidGroup([5, 5])).toBe(false); // would XOR to 0 but the deck has no duplicates
  });

  it('rejects duplicate values even if they cancel', () => {
    expect(isValidGroup([3, 3, 6, 6])).toBe(false);
  });

  it('accepts a valid larger group', () => {
    // 1 ^ 2 ^ 4 ^ 7 == 0
    expect(isValidGroup([1, 2, 4, 7])).toBe(true);
  });
});

describe('bestGroup (spec §6 selection rule)', () => {
  it('returns null when no valid group exists', () => {
    expect(bestGroup([1, 2, 8, 16])).toBeNull();
    expect(hasValidGroup([1, 2, 8, 16])).toBe(false);
  });

  it('finds a simple 3-card group', () => {
    const g = bestGroup([3, 6, 5, 8]);
    expect(g).not.toBeNull();
    expect(new Set(g!)).toEqual(new Set([3, 6, 5]));
  });

  it('prefers more cards over fewer', () => {
    // The only zero-XOR subset here is the 4-card group {1,2,4,7}; the extra
    // card 8 never completes a group, so the best group is those four.
    const g = bestGroup([1, 2, 4, 7, 8]);
    expect(g!.length).toBe(4);
    expect(new Set(g!)).toEqual(new Set([1, 2, 4, 7]));
  });

  it('breaks ties by most total dots', () => {
    // This table has exactly three 4-card zero groups (a 2-dimensional space
    // of zero-sets), all the same max size, with different dot totals:
    //   {4,7,1,2}  -> dots 1+3+1+1 = 6
    //   {1,2,8,11} -> dots 1+1+1+3 = 6
    //   {4,7,8,11} -> dots 1+3+1+3 = 8   <- most dots, should win
    const g = bestGroup([4, 7, 1, 2, 8, 11]);
    expect(g!.length).toBe(4);
    expect(new Set(g!)).toEqual(new Set([4, 7, 8, 11]));
  });
});

describe('difficulty decks (spec §8)', () => {
  const expected: Record<Difficulty, { size: number; max: number; table: number }> = {
    easy: { size: 7, max: 7, table: 4 },
    medium: { size: 15, max: 15, table: 5 },
    normal: { size: 31, max: 31, table: 6 },
    master: { size: 63, max: 63, table: 7 },
  };

  (Object.keys(expected) as Difficulty[]).forEach((d) => {
    it(`${d}: correct deck size, values, and table size`, () => {
      const deck = buildDeck(d);
      expect(deck.length).toBe(expected[d].size);
      expect(deck.length).toBe(DIFFICULTY[d].deckSize);
      expect(Math.min(...deck)).toBe(1);
      expect(Math.max(...deck)).toBe(expected[d].max);
      expect(new Set(deck).size).toBe(deck.length); // all distinct
      expect(DIFFICULTY[d].tableSize).toBe(expected[d].table);
    });
  });
});

describe('shuffle', () => {
  it('is a permutation (no cards lost or duplicated)', () => {
    const deck = buildDeck('master');
    const shuffled = shuffle(deck, 12345);
    expect(shuffled.length).toBe(deck.length);
    expect(new Set(shuffled)).toEqual(new Set(deck));
  });

  it('is deterministic when seeded', () => {
    expect(shuffle(buildDeck('normal'), 42)).toEqual(shuffle(buildDeck('normal'), 42));
  });

  it('does not mutate the input', () => {
    const deck = buildDeck('easy');
    const copy = deck.slice();
    shuffle(deck, 1);
    expect(deck).toEqual(copy);
  });
});
