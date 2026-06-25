/** Landing screen: solo timed game + multiplayer (create / join / quick match). */
import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { createGame, joinGame, quickMatch } from '../lib/api';
import { formatTime } from '../lib/format';
import { getBest } from '../lib/leaderboard';
import { DIFFICULTY, type Difficulty } from '../lib/xor';
import type { BotSkill } from './AiGame';
import './Home.css';

const ORDER: Difficulty[] = ['easy', 'medium', 'normal', 'master'];

export interface HomeProps {
  onStartSolo: (difficulty: Difficulty) => void;
  onStartAi: (difficulty: Difficulty, botCount: number, skill: BotSkill) => void;
  onEnterGame: (gameId: string) => void;
}

export function Home({ onStartSolo, onStartAi, onEnterGame }: HomeProps) {
  const auth = useAuth();
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [botCount, setBotCount] = useState(2);
  const [skill, setSkill] = useState<BotSkill>('even');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const best = getBest(difficulty);

  const online = auth.configured && auth.ready;
  const mpDisabled = !online || busy !== null;

  const run = async (label: string, fn: () => Promise<{ id: string }>) => {
    setError(null);
    setBusy(label);
    try {
      const game = await fn();
      onEnterGame(game.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setBusy(null);
    }
  };

  return (
    <main className="home">
      <h1 className="home__wordmark wordmark">Xor0</h1>
      <p className="home__tagline">
        Find a set of cards whose colored dots all cancel out — every color an even number of times —
        and shout <strong>XORO!</strong> Clear cards faster than anyone else.
      </p>

      <section className="home__panel">
        <h2 className="home__h2">Solo · against the clock</h2>
        <div className="home__levels" role="radiogroup" aria-label="Difficulty">
          {ORDER.map((d) => (
            <button
              key={d}
              role="radio"
              aria-checked={difficulty === d}
              className={`level${difficulty === d ? ' level--on' : ''}`}
              onClick={() => setDifficulty(d)}
            >
              <span className="level__name">{DIFFICULTY[d].label}</span>
              <span className="level__meta">
                {DIFFICULTY[d].deckSize} cards · {DIFFICULTY[d].tableSize} up
              </span>
            </button>
          ))}
        </div>
        <p className="home__best">
          {best
            ? `Your best: ${formatTime(best.timeMs)} · ${best.cards} cards`
            : 'No personal best yet — set one!'}
        </p>
        <button className="btn btn--primary home__start" onClick={() => onStartSolo(difficulty)}>
          Start solo game
        </button>
      </section>

      <section className="home__panel">
        <h2 className="home__h2">Practice · vs AI</h2>
        <p className="home__soon">Race {botCount} bot{botCount === 1 ? '' : 's'} at the chosen level.</p>
        <div className="home__airow">
          <label>
            Bots{' '}
            <select value={botCount} onChange={(e) => setBotCount(Number(e.target.value))}>
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            Skill{' '}
            <select value={skill} onChange={(e) => setSkill(e.target.value as BotSkill)}>
              <option value="chill">Chill</option>
              <option value="even">Even</option>
              <option value="sharp">Sharp</option>
            </select>
          </label>
        </div>
        <button
          className="btn btn--primary home__start"
          onClick={() => onStartAi(difficulty, botCount, skill)}
        >
          Play vs AI
        </button>
      </section>

      <section className="home__panel">
        <h2 className="home__h2">Multiplayer</h2>
        {!auth.configured && (
          <p className="home__soon">Connect Supabase to enable online play.</p>
        )}

        <div className="home__mpbtns">
          <button
            className="btn btn--primary"
            disabled={mpDisabled}
            onClick={() => run('create', () => createGame(difficulty, 'private'))}
          >
            {busy === 'create' ? 'Creating…' : 'Create room'}
          </button>
          <button
            className="btn btn--ghost"
            disabled={mpDisabled}
            onClick={() => run('quick', () => quickMatch(difficulty))}
          >
            {busy === 'quick' ? 'Matching…' : 'Quick match'}
          </button>
        </div>

        <form
          className="home__join"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) run('join', () => joinGame(code));
          }}
        >
          <input
            className="home__codeinput"
            placeholder="Room code"
            value={code}
            maxLength={6}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            disabled={mpDisabled}
            aria-label="Room code"
          />
          <button className="btn btn--ghost" disabled={mpDisabled || !code.trim()} type="submit">
            {busy === 'join' ? 'Joining…' : 'Join'}
          </button>
        </form>

        {error && <p className="home__error">{error}</p>}
        {auth.configured && (
          <p className="home__who">
            {auth.ready
              ? `Playing as ${auth.displayName ?? 'guest'}${auth.isAnonymous ? ' (guest)' : ''}`
              : 'Signing in…'}
          </p>
        )}
      </section>
    </main>
  );
}
