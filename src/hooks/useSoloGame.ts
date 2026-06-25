/** React state wrapper around the pure solo engine (src/lib/solo.ts). */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  attemptClaim,
  createSoloGame,
  scoreOf,
  soloHint,
  type ClaimResult,
  type SoloState,
} from '../lib/solo';
import { recordSoloScore } from '../lib/leaderboard';
import type { CardValue, Difficulty } from '../lib/xor';

export interface UseSoloGame {
  state: SoloState;
  /** Live elapsed ms (updates while playing). */
  elapsedMs: number;
  selected: CardValue[];
  toggle: (v: CardValue) => void;
  clearSelection: () => void;
  /** True when the current selection is a claimable XORO group. */
  canClaim: boolean;
  claim: () => ClaimResult;
  hint: () => void;
  hinted: CardValue[];
  newGame: (difficulty?: Difficulty) => void;
  /** Set when a game just finished, including whether it was a personal best. */
  finishedBest: boolean | null;
}

export function useSoloGame(initialDifficulty: Difficulty): UseSoloGame {
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

  // Record the score once when a game ends.
  useEffect(() => {
    if (state.status === 'over' && !recordedRef.current) {
      recordedRef.current = true;
      setFinishedBest(recordSoloScore(scoreOf(state)));
    }
  }, [state]);

  const toggle = useCallback((v: CardValue) => {
    setHinted([]);
    setSelected((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]));
  }, []);

  const clearSelection = useCallback(() => setSelected([]), []);

  const claimable = useMemo(() => {
    const { result } = attemptClaim(state, selected);
    return result === 'ok';
  }, [state, selected]);

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
    canClaim: claimable,
    claim,
    hint,
    hinted,
    newGame,
    finishedBest,
  };
}
