import { describe, it, expect } from 'vitest';
import {
  createLocalGame,
  claimLocal,
  botMove,
  winnerOf,
  HUMAN_ID,
  type LocalState,
} from './localGame';
import { hasValidGroup, isValidGroup } from './xor';

const BOTS = [{ name: 'Bot A', reactionMs: 1000 }];

describe('createLocalGame', () => {
  it('seats the human plus the bots and deals a playable table', () => {
    const g = createLocalGame('normal', BOTS, 1, 0);
    expect(g.players.map((p) => p.id)).toEqual([HUMAN_ID, 'ai0']);
    expect(g.players[0].isAI).toBe(false);
    expect(g.players[1].isAI).toBe(true);
    expect(hasValidGroup(g.table)).toBe(true);
  });
});

describe('claimLocal', () => {
  it('awards a valid claim and replenishes the table', () => {
    const g = createLocalGame('normal', BOTS, 2, 0);
    const group = botMove(g, HUMAN_ID)!;
    const { state, result } = claimLocal(g, HUMAN_ID, group, 0);
    expect(['claimed', 'claimed_final']).toContain(result);
    const me = state.players.find((p) => p.id === HUMAN_ID)!;
    expect(me.cardCount).toBe(group.length);
    for (const v of group) expect(state.table).not.toContain(v);
  });

  it('pauses a player on a wrong (non-zero-XOR) claim', () => {
    const g = createLocalGame('normal', BOTS, 3, 0);
    const bad = g.table.slice(0, 3);
    if (!isValidGroup(bad)) {
      const { state, result } = claimLocal(g, HUMAN_ID, bad, 0);
      expect(result).toBe('invalid');
      expect(state.players.find((p) => p.id === HUMAN_ID)!.status).toBe('paused');
    }
  });

  it('a valid claim un-pauses everyone', () => {
    let g = createLocalGame('normal', BOTS, 4, 0);
    // Force the human into a paused state.
    g = { ...g, players: g.players.map((p) => (p.id === HUMAN_ID ? { ...p, status: 'paused' } : p)) };
    const group = botMove(g, 'ai0')!;
    const { state } = claimLocal(g, 'ai0', group, 0);
    expect(state.players.find((p) => p.id === HUMAN_ID)!.status).toBe('active');
  });

  it('returns too_slow for a valid group whose cards were already taken', () => {
    const g = createLocalGame('normal', BOTS, 5, 0);
    const group = botMove(g, HUMAN_ID)!;
    const after = claimLocal(g, HUMAN_ID, group, 0).state;
    // Re-submit the same group against the new table.
    const { result } = claimLocal(after, 'ai0', group, 0);
    expect(['too_slow', 'invalid']).toContain(result); // cards gone (or no longer a group)
  });
});

describe('full local playthrough', () => {
  it('terminates with a winner; all cards distributed across players', () => {
    let g: LocalState = createLocalGame('master', BOTS, 9, 0);
    let guard = 0;
    // Alternate claimers to exercise multiple players.
    const ids = [HUMAN_ID, 'ai0'];
    while (g.status === 'playing' && guard < 2000) {
      const claimer = ids[guard % 2];
      const move = botMove(g, claimer) ?? botMove(g, ids[(guard + 1) % 2]);
      if (!move) break;
      const who = botMove(g, claimer) ? claimer : ids[(guard + 1) % 2];
      g = claimLocal(g, who, move, 0).state;
      guard++;
    }
    expect(g.status).toBe('over');
    expect(g.winnerId).not.toBeNull();
    const totalCards = g.players.reduce((s, p) => s + p.cardCount, 0);
    expect(totalCards).toBe(63); // master deck fully cleared
    expect(winnerOf(g)).toBe(g.winnerId);
  });
});
