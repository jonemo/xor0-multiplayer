import { describe, it, expect } from 'vitest';
import {
  createSoloGame,
  attemptClaim,
  soloHint,
  scoreOf,
  type SoloState,
} from './solo';
import { hasValidGroup, isValidGroup, DIFFICULTY, type Difficulty } from './xor';

const DIFFS: Difficulty[] = ['easy', 'medium', 'normal', 'master'];

describe('createSoloGame', () => {
  it('deals a playable table (a valid group always exists at start)', () => {
    for (const d of DIFFS) {
      for (let seed = 0; seed < 20; seed++) {
        const g = createSoloGame(d, seed, 0);
        expect(g.status).toBe('playing');
        expect(g.table.length).toBeGreaterThanOrEqual(DIFFICULTY[d].tableSize);
        expect(hasValidGroup(g.table)).toBe(true);
      }
    }
  });

  it('uses the full difficulty deck with no duplicates', () => {
    const g = createSoloGame('normal', 7, 0);
    expect(g.deck.length).toBe(DIFFICULTY.normal.deckSize);
    expect(new Set(g.deck).size).toBe(g.deck.length);
  });
});

describe('attemptClaim', () => {
  it('rejects an invalid (non-zero-XOR) selection: counts the miss, banks nothing', () => {
    const g = createSoloGame('normal', 1, 0);
    const bad = g.table.slice(0, 3);
    if (!isValidGroup(bad)) {
      const { state, result } = attemptClaim(g, bad, 0);
      expect(result).toBe('invalid');
      // table/collected untouched, but the incorrect-guess counter ticks up
      expect(state.table).toEqual(g.table);
      expect(state.collected).toEqual(g.collected);
      expect(state.incorrectAttempts).toBe(g.incorrectAttempts + 1);
    }
  });

  it('does not count a valid claim as an incorrect guess', () => {
    const g = createSoloGame('normal', 3, 0);
    const group = soloHint(g)!;
    const { state } = attemptClaim(g, group, 0);
    expect(state.incorrectAttempts).toBe(0);
  });

  it('rejects cards not on the table', () => {
    const g = createSoloGame('easy', 2, 0);
    const { result } = attemptClaim(g, [1, 2, 3], 0);
    // 1^2^3 == 0 but these specific cards may not all be face up
    if (!g.table.includes(1) || !g.table.includes(2) || !g.table.includes(3)) {
      expect(result).toBe('not-on-table');
    }
  });

  it('claims a valid group, banks the cards, and keeps the table playable', () => {
    let g = createSoloGame('normal', 3, 0);
    const group = soloHint(g)!;
    const before = g.collected.length;
    const { state, result } = attemptClaim(g, group, 0);
    expect(result).toBe('ok');
    expect(state.collected.length).toBe(before + group.length);
    // claimed cards left the table
    for (const v of group) expect(state.table).not.toContain(v);
    // still playable (unless the game just ended)
    if (state.status === 'playing') expect(hasValidGroup(state.table)).toBe(true);
    g = state;
  });
});

describe('full playthrough', () => {
  it('always terminates and banks a sensible score (greedy bestGroup play)', () => {
    for (const d of DIFFS) {
      let g: SoloState = createSoloGame(d, 99, 0);
      let guard = 0;
      while (g.status === 'playing' && guard++ < 1000) {
        const group = soloHint(g);
        expect(group).not.toBeNull(); // playing implies a group exists
        g = attemptClaim(g, group!, 0).state;
      }
      expect(g.status).toBe('over');
      const score = scoreOf(g, 0);
      expect(score.cards).toBeGreaterThan(0);
      expect(score.cards).toBeLessThanOrEqual(DIFFICULTY[d].deckSize);
      // every collected card is unique
      expect(new Set(g.collected).size).toBe(g.collected.length);
    }
  });
});

describe('scoreOf', () => {
  it('computes elapsed time and dot count', () => {
    const g = createSoloGame('easy', 5, 1000);
    const s = scoreOf(g, 4000);
    expect(s.timeMs).toBe(3000);
    expect(s.cards).toBe(0);
    expect(s.incorrectGuesses).toBe(0);
  });

  it('carries the incorrect-guess count into the score', () => {
    let g = createSoloGame('normal', 1, 0);
    const bad = g.table.slice(0, 3);
    if (!isValidGroup(bad)) {
      g = attemptClaim(g, bad, 0).state;
      expect(scoreOf(g, 0).incorrectGuesses).toBe(1);
    }
  });
});
