/** Landing screen: solo timed game + multiplayer (create / join / quick match). */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { AccountDialog } from '../components/AccountDialog';
import { createGame, joinGame, quickMatch } from '../lib/api';
import { formatTime } from '../lib/format';
import { getBest } from '../lib/leaderboard';
import { BUY_URL } from '../lib/links';
import { DIFFICULTY, type Difficulty } from '../lib/xor';
import './Home.css';

const ORDER: Difficulty[] = ['easy', 'medium', 'normal', 'master'];

export interface HomeProps {
  onStartSolo: (difficulty: Difficulty) => void;
  onEnterGame: (gameId: string) => void;
  onShowLeaderboard: () => void;
}

export function Home({ onStartSolo, onEnterGame, onShowLeaderboard }: HomeProps) {
  const auth = useAuth();
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [showAccount, setShowAccount] = useState(false);
  // A QR/shared link lands here as ?room=CODE — prefill it and auto-join.
  const initialRoom = useMemo(
    () => new URLSearchParams(window.location.search).get('room')?.trim().toUpperCase() ?? '',
    [],
  );
  const [code, setCode] = useState(initialRoom);
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

  // Join the room from the link once auth is ready, then drop the param so a
  // refresh or back-navigation doesn't re-trigger the join.
  const autoJoined = useRef(false);
  useEffect(() => {
    if (!initialRoom || autoJoined.current || !online) return;
    autoJoined.current = true;
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState({}, '', url.toString());
    run('join', () => joinGame(initialRoom));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, initialRoom]);

  const accountLabel = !auth.ready
    ? 'Signing in…'
    : auth.isAnonymous
      ? `${auth.displayName ?? 'guest'} (guest)`
      : (auth.displayName ?? 'Account');

  return (
    <main className="home">
      <div className="home__top">
        <div className="home__top-left">
          <button className="home__chip" onClick={onShowLeaderboard}>
            🏆 Leaderboard
          </button>
          <a
            className="home__chip"
            href={BUY_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            🛒 Buy the Game
          </a>
        </div>
        {auth.configured && (
          <button className="home__chip" onClick={() => setShowAccount(true)}>
            {accountLabel}
          </button>
        )}
      </div>

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
      </section>

      {showAccount && <AccountDialog onClose={() => setShowAccount(false)} />}
    </main>
  );
}
