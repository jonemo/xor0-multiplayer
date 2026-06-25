/** React wrapper for the local human-vs-AI game; schedules bot claims on timers. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  botMove,
  claimLocal,
  createLocalGame,
  HUMAN_ID,
  type BotSpec,
  type LocalState,
} from '../lib/localGame';
import { isValidGroup, type CardValue } from '../lib/xor';

export interface LocalEvent {
  name: string;
  kind: 'claim' | 'penalty' | 'slow';
  cards: number;
}

export function useLocalGame(difficulty: Parameters<typeof createLocalGame>[0], bots: BotSpec[]) {
  const [state, setState] = useState<LocalState>(() => createLocalGame(difficulty, bots));
  const [selected, setSelected] = useState<CardValue[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [lastEvent, setLastEvent] = useState<LocalEvent | null>(null);
  const timers = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }, []);

  // Live elapsed clock.
  useEffect(() => {
    if (state.status !== 'playing') return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [state.status]);

  // Drop any selected cards that left the table.
  useEffect(() => {
    setSelected((sel) => sel.filter((v) => state.table.includes(v)));
  }, [state.table]);

  // (Re)schedule bot claims whenever the table or anyone's status changes.
  const statusSig = state.players.map((p) => p.status).join(',');
  useEffect(() => {
    clearTimers();
    if (state.status !== 'playing') return;

    for (const p of state.players) {
      if (!p.isAI || p.status !== 'active') continue;
      if (!botMove(state, p.id)) continue;
      const delay = p.reactionMs + Math.random() * p.reactionMs * 0.6;
      const id = window.setTimeout(() => {
        setState((prev) => {
          const move = botMove(prev, p.id);
          if (!move) return prev;
          const { state: next, result } = claimLocal(prev, p.id, move);
          if (result === 'claimed' || result === 'claimed_final') {
            setLastEvent({ name: p.name, kind: 'claim', cards: move.length });
          }
          return next;
        });
      }, delay);
      timers.current.push(id);
    }
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.table, state.deckPointer, state.status, statusSig]);

  const me = useMemo(() => state.players.find((p) => p.id === HUMAN_ID)!, [state.players]);

  const toggle = useCallback(
    (v: CardValue) => {
      if (me.status === 'paused') return;
      setSelected((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]));
    },
    [me.status],
  );

  const clearSelection = useCallback(() => setSelected([]), []);

  const canClaim =
    state.status === 'playing' &&
    me.status === 'active' &&
    isValidGroup(selected) &&
    selected.every((v) => state.table.includes(v));

  const claim = useCallback(() => {
    setState((prev) => {
      const { state: next, result } = claimLocal(prev, HUMAN_ID, selected);
      if (result === 'claimed' || result === 'claimed_final') {
        setLastEvent({ name: 'You', kind: 'claim', cards: selected.length });
        setSelected([]);
      } else if (result === 'invalid') {
        setLastEvent({ name: 'You', kind: 'penalty', cards: 0 });
      } else if (result === 'too_slow') {
        setLastEvent({ name: 'You', kind: 'slow', cards: 0 });
        setSelected([]);
      }
      return next;
    });
  }, [selected]);

  const newGame = useCallback(() => {
    clearTimers();
    setSelected([]);
    setLastEvent(null);
    setState(createLocalGame(difficulty, bots));
    setNow(Date.now());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficulty]);

  const elapsedMs = (state.finishedAt ?? now) - state.startedAt;

  return { state, me, elapsedMs, selected, toggle, clearSelection, canClaim, claim, newGame, lastEvent };
}
