/** Global solo leaderboard: best run per player, per difficulty. */
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { fetchLeaderboard, type LeaderboardEntry } from '../lib/api';
import { formatTime } from '../lib/format';
import { DIFFICULTY, type Difficulty } from '../lib/xor';
import './Leaderboard.css';

const ORDER: Difficulty[] = ['easy', 'medium', 'normal', 'master'];

export interface LeaderboardProps {
  onExit: () => void;
}

export function Leaderboard({ onExit }: LeaderboardProps) {
  const auth = useAuth();
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setEntries(null);
    setError(null);
    fetchLeaderboard(difficulty)
      .then((rows) => {
        if (active) setEntries(rows);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Could not load leaderboard');
      });
    return () => {
      active = false;
    };
  }, [difficulty]);

  return (
    <main className="lb">
      <header className="lb__bar">
        <button className="btn btn--ghost" onClick={onExit}>
          ← Menu
        </button>
        <h1 className="lb__title wordmark">Leaderboard</h1>
        <span className="lb__spacer" />
      </header>

      <div className="lb__levels" role="radiogroup" aria-label="Difficulty">
        {ORDER.map((d) => (
          <button
            key={d}
            role="radio"
            aria-checked={difficulty === d}
            className={`level${difficulty === d ? ' level--on' : ''}`}
            onClick={() => setDifficulty(d)}
          >
            <span className="level__name">{DIFFICULTY[d].label}</span>
          </button>
        ))}
      </div>

      <section className="lb__panel">
        {error ? (
          <p className="lb__empty">{error}</p>
        ) : entries === null ? (
          <p className="lb__empty">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="lb__empty">No scores yet — be the first to clear this deck!</p>
        ) : (
          <ol className="lb__list">
            {entries.map((e, i) => (
              <li
                key={e.userId}
                className={`lb__row${e.userId === auth.user?.id ? ' lb__row--me' : ''}`}
              >
                <span className="lb__rank">{i + 1}</span>
                <span className="lb__name">{e.displayName}</span>
                <span className="lb__cards">{e.cards} cards</span>
                <span className="lb__time">{formatTime(e.timeMs)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
