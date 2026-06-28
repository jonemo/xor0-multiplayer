/** React state wrapper around the pure solo engine (src/lib/solo.ts). */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  attemptClaim,
  createSoloGame,
  scoreOf,
  soloHint,
  type ClaimResult,
  type SoloState,
} from '../lib/solo';
import { recordSoloScore } from '../lib/leaderboard';
import { recordSoloScoreRemote } from '../lib/api';
import { useAuth } from '../auth/AuthProvider';
import type { CardValue, Difficulty } from '../lib/xor';

export interface UseSoloGame {
  state: SoloState;
  /** Live elapsed ms (updates while playing). */
  elapsedMs: number;
  selected: CardValue[];
  toggle: (v: CardValue) => void;
  clearSelection: () => void;
  /** True when a claim can be attempted (game in progress, cards selected). */
  canClaim: boolean;
  claim: () => ClaimResult;
  hint: () => void;
  hinted: CardValue[];
  newGame: (difficulty?: Difficulty) => void;
  /** Set when a game just finished, including whether it was a personal best. */
  finishedBest: boolean | null;
}

export function useSoloGame(initialDifficulty: Difficulty): UseSoloGame {
  const { user, configured } = useAuth();
  const [state, setState] = useState<SoloState>(() => createSoloGame(initialDifficulty));
  const [selected, setSelected] = useState<CardValue[]>([]);
  const [hinted, setHinted] = useState<CardValue[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [finishedBest, setFinishedBest] = useState<boolean | null>(null);
  const recordedRef = useRef(false);

  // Live timer tick while playing.
  useEffect(() => {
    if (state.status !== 'playing') return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [state.status]);

  // Record the score once when a game ends: locally (best time) and, when
  // signed in, to the global leaderboard (best-effort — never blocks the UI).
  useEffect(() => {
    if (state.status === 'over' && !recordedRef.current) {
      recordedRef.current = true;
      // A run where the player revealed a hint is not eligible for any
      // leaderboard (local best or global) — otherwise it'd be trivial to cheat.
      if (state.hintUsed) {
        setFinishedBest(false);
        return;
      }
      const score = scoreOf(state);
      setFinishedBest(recordSoloScore(score));
      if (configured && user) {
        recordSoloScoreRemote(user.id, score).catch(() => {
          /* offline / transient — local best is already saved */
        });
      }
    }
  }, [state, configured, user]);

  const toggle = useCallback((v: CardValue) => {
    setHinted([]);
    setSelected((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]));
  }, []);

  const clearSelection = useCallback(() => setSelected([]), []);

  // Any non-empty selection can be submitted; claim() reports back whether it
  // was valid so the UI can give feedback. (Solo has no penalty — see screen.)
  const canClaim = state.status === 'playing' && selected.length > 0;

  const claim = useCallback((): ClaimResult => {
    const { state: next, result } = attemptClaim(state, selected);
    if (result === 'ok') {
      setState(next);
      setSelected([]);
      setHinted([]);
    }
    return result;
  }, [state, selected]);

  const hint = useCallback(() => {
    setHinted(soloHint(state) ?? []);
    setState((s) => (s.hintUsed ? s : { ...s, hintUsed: true }));
  }, [state]);

  const newGame = useCallback((difficulty?: Difficulty) => {
    recordedRef.current = false;
    setFinishedBest(null);
    setSelected([]);
    setHinted([]);
    setState((prev) => createSoloGame(difficulty ?? prev.difficulty));
    setNow(Date.now());
  }, []);

  const elapsedMs = (state.finishedAt ?? now) - state.startedAt;

  return {
    state,
    elapsedMs,
    selected,
    toggle,
    clearSelection,
    canClaim,
    claim,
    hint,
    hinted,
    newGame,
    finishedBest,
  };
}
