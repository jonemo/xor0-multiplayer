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
  // Always-current state so bot timers read fresh data without re-subscribing.
  const stateRef = useRef(state);
  stateRef.current = state;

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
  //
  // Each bot repeatedly "looks" at the table: after a randomized delay it either
  // grabs the best set or, with missChance, fails to spot it and looks again.
  // That gives a human time to find and click a set first — a bot is NOT an
  // instant optimal player, it just thinks fast.
  const statusSig = state.players.map((p) => p.status).join(',');
  useEffect(() => {
    clearTimers();
    if (state.status !== 'playing') return;

    const scheduleLook = (botId: string, name: string, baseMs: number, missChance: number) => {
      const delay = baseMs * (0.6 + Math.random()); // 0.6x – 1.6x
      const id = window.setTimeout(() => {
        const cur = stateRef.current;
        const p = cur.players.find((x) => x.id === botId);
        if (!p || p.status !== 'active' || cur.status !== 'playing') return;
        if (!botMove(cur, botId)) return; // nothing claimable right now
        if (Math.random() < missChance) {
          scheduleLook(botId, name, baseMs, missChance); // didn't spot it — look again
          return;
        }
        setState((prev) => {
          const move = botMove(prev, botId);
          if (!move) return prev;
          const { state: next, result } = claimLocal(prev, botId, move);
          if (result === 'claimed' || result === 'claimed_final') {
            setLastEvent({ name, kind: 'claim', cards: move.length });
          }
          return next;
        });
      }, delay);
      timers.current.push(id);
    };

    for (const p of state.players) {
      if (p.isAI && p.status === 'active') scheduleLook(p.id, p.name, p.baseMs, p.missChance);
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
