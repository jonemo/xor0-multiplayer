/** Local human-vs-AI game screen (fully offline; no Supabase). */
import { useEffect, useState } from 'react';
import { Table } from '../components/Table';
import { useLocalGame } from '../hooks/useLocalGame';
import { HUMAN_ID, type BotSpec } from '../lib/localGame';
import { formatTime } from '../lib/format';
import { DIFFICULTY, popcount, type Difficulty } from '../lib/xor';
import './MultiplayerGame.css';
import './SoloGame.css';

export type BotSkill = 'chill' | 'even' | 'sharp';

/** Base reaction time (ms) per skill — lower is harder to beat. */
const SKILL_MS: Record<BotSkill, number> = { chill: 2800, even: 1700, sharp: 950 };
const BOT_NAMES = ['Ada', 'Boole', 'Gauss', 'Turing', 'Lovelace'];

export function makeBots(count: number, skill: BotSkill): BotSpec[] {
  // All bots share the same base reaction; the per-table random jitter in
  // useLocalGame decides each race, so multiple bots trade wins fairly (rather
  // than the lowest-indexed bot always firing first).
  return Array.from({ length: count }, (_, i) => ({
    name: BOT_NAMES[i % BOT_NAMES.length],
    reactionMs: SKILL_MS[skill],
  }));
}

export interface AiGameProps {
  difficulty: Difficulty;
  botCount: number;
  skill: BotSkill;
  onExit: () => void;
}

export function AiGame({ difficulty, botCount, skill, onExit }: AiGameProps) {
  const [bots] = useState<BotSpec[]>(() => makeBots(botCount, skill));
  const game = useLocalGame(difficulty, bots);
  const { state, me, selected, elapsedMs } = game;
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!game.lastEvent) return;
    const e = game.lastEvent;
    const msg =
      e.kind === 'claim'
        ? `${e.name} took ${e.cards} card${e.cards === 1 ? '' : 's'}`
        : e.kind === 'penalty'
          ? 'Wrong — you are paused'
          : 'Too slow!';
    setToast(msg);
    const id = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(id);
  }, [game.lastEvent]);

  const paused = me.status === 'paused';
  const selectedDots = selected.reduce((s, v) => s + popcount(v), 0);
  const ranked = [...state.players].sort(
    (a, b) => b.cardCount - a.cardCount || b.dotCount - a.dotCount,
  );

  return (
    <main className="mp">
      <header className="mp__bar">
        <button className="btn btn--ghost" onClick={onExit}>
          ← Menu
        </button>
        <div className="mp__code">
          vs AI · {DIFFICULTY[difficulty].label} ·{' '}
          <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formatTime(elapsedMs)}</strong>
        </div>
      </header>

      {toast && <div className="mp__toast">{toast}</div>}

      <div className="mp__layout">
        <aside className="scoreboard">
          <h3>Players</h3>
          <ul>
            {ranked.map((p) => (
              <li
                key={p.id}
                className={[
                  p.id === HUMAN_ID ? 'is-me' : '',
                  p.status === 'paused' ? 'is-paused' : '',
                  state.status === 'over' && p.id === state.winnerId ? 'is-winner' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <span className="scoreboard__name">
                  {p.name}
                  {p.status === 'paused' && ' ⏸'}
                </span>
                <span className="scoreboard__score">
                  {p.cardCount}
                  <span className="scoreboard__dots"> · {p.dotCount}d</span>
                </span>
              </li>
            ))}
          </ul>
        </aside>

        <section className="mp__main">
          <Table
            table={state.table}
            selected={selected}
            onToggle={paused || state.status !== 'playing' ? undefined : game.toggle}
          />
          {paused && state.status === 'playing' && (
            <div className="mp__paused">Paused — wait for the next valid XORO to rejoin.</div>
          )}

          {state.status === 'over' && (
            <div className="results">
              <h2>{state.winnerId === HUMAN_ID ? 'You win! 🎉' : `${winnerName(ranked)} wins`}</h2>
              <ol className="results__list">
                {ranked.map((p) => (
                  <li key={p.id} className={p.id === HUMAN_ID ? 'is-me' : ''}>
                    <span>{p.name}</span>
                    <span>
                      {p.cardCount} cards · {p.dotCount} dots
                    </span>
                  </li>
                ))}
              </ol>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button className="btn btn--primary" onClick={game.newGame}>
                  Play again
                </button>
                <button className="btn btn--ghost" onClick={onExit}>
                  Menu
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {state.status === 'playing' && (
        <footer className="mp__actions">
          <button className="btn btn--primary btn--xoro" disabled={!game.canClaim} onClick={game.claim}>
            XORO!{' '}
            {selected.length > 0 && (
              <span className="btn__sub">
                {selected.length} card{selected.length === 1 ? '' : 's'} · {selectedDots} dots
              </span>
            )}
          </button>
          <button
            className="btn btn--ghost"
            disabled={!selected.length}
            onClick={game.clearSelection}
          >
            Clear
          </button>
        </footer>
      )}
    </main>
  );
}

function winnerName(ranked: { id: string; name: string }[]): string {
  return ranked[0]?.name ?? 'Nobody';
}
