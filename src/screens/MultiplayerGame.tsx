/** Multiplayer room: lobby -> active board -> results, driven by realtime state. */
import { useEffect, useMemo, useState } from 'react';
import { Table } from '../components/Table';
import { useGame } from '../hooks/useGame';
import { useAuth } from '../auth/AuthProvider';
import { claimGroup, leaveGame, startGame } from '../lib/api';
import { isValidGroup, popcount, type CardValue } from '../lib/xor';
import type { GamePlayerRow } from '../lib/database.types';
import './MultiplayerGame.css';

export interface MultiplayerGameProps {
  gameId: string;
  onExit: () => void;
}

export function MultiplayerGame({ gameId, onExit }: MultiplayerGameProps) {
  const { user } = useAuth();
  const { game, players, latestClaim, loading } = useGame(gameId);
  const [selected, setSelected] = useState<CardValue[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const me = useMemo(
    () => players.find((p) => p.user_id === user?.id) ?? null,
    [players, user],
  );
  const isHost = game?.host_id === user?.id;
  const paused = me?.status === 'paused';

  // Surface claim events as a brief toast.
  useEffect(() => {
    if (!latestClaim) return;
    const who = players.find((p) => p.id === latestClaim.player_id)?.display_name ?? 'Someone';
    const msg =
      latestClaim.outcome === 'penalty'
        ? `${who} mis-claimed — paused`
        : latestClaim.outcome === 'too_slow'
          ? `${who} was too slow`
          : `${who} took ${latestClaim.card_values.length} cards`;
    setToast(msg);
    const id = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(id);
  }, [latestClaim, players]);

  // Clear any stale selection when the table changes.
  useEffect(() => {
    setSelected((sel) => sel.filter((v) => game?.table_cards.includes(v)));
  }, [game?.table_cards]);

  if (loading || !game) {
    return <main className="mp mp--center">Loading game…</main>;
  }

  const toggle = (v: CardValue) =>
    setSelected((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]));

  const doClaim = async () => {
    setBusy(true);
    try {
      const outcome = await claimGroup(gameId, selected);
      if (outcome === 'too_slow') setToast('Too slow — those cards were taken');
      setSelected([]);
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Claim failed');
    } finally {
      setBusy(false);
    }
  };

  const doStart = async () => {
    setBusy(true);
    try {
      await startGame(gameId);
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Could not start');
    } finally {
      setBusy(false);
    }
  };

  const doLeave = async () => {
    try {
      await leaveGame(gameId);
    } finally {
      onExit();
    }
  };

  const canClaim = !paused && !busy && isValidGroup(selected);
  const selectedDots = selected.reduce((s, v) => s + popcount(v), 0);

  return (
    <main className="mp">
      <header className="mp__bar">
        <button className="btn btn--ghost" onClick={doLeave}>
          ← Leave
        </button>
        <div className="mp__code">
          Room <strong>{game.code}</strong>
          {game.visibility === 'public' && <span className="mp__pill">public</span>}
        </div>
      </header>

      {toast && <div className="mp__toast">{toast}</div>}

      <div className="mp__layout">
        <ScoreBoard players={players} meId={me?.id} winnerId={game.winner_id} />

        <section className="mp__main">
          {game.status === 'lobby' && (
            <Lobby code={game.code} isHost={isHost} busy={busy} onStart={doStart} players={players} />
          )}

          {game.status === 'active' && (
            <>
              <Table
                table={game.table_cards}
                selected={selected}
                onToggle={paused ? undefined : toggle}
              />
              {paused && (
                <div className="mp__paused">Paused — wait for the next valid XORO to rejoin.</div>
              )}
            </>
          )}

          {game.status === 'finished' && (
            <Results players={players} winnerId={game.winner_id} meId={me?.id} onExit={onExit} />
          )}
        </section>
      </div>

      {game.status === 'active' && (
        <footer className="mp__actions">
          <button className="btn btn--primary btn--xoro" disabled={!canClaim} onClick={doClaim}>
            XORO!{' '}
            {selected.length > 0 && (
              <span className="btn__sub">
                {selected.length} card{selected.length === 1 ? '' : 's'} · {selectedDots} dots
              </span>
            )}
          </button>
          <button className="btn btn--ghost" disabled={!selected.length} onClick={() => setSelected([])}>
            Clear
          </button>
        </footer>
      )}
    </main>
  );
}

function Lobby({
  code,
  isHost,
  busy,
  onStart,
  players,
}: {
  code: string;
  isHost: boolean;
  busy: boolean;
  onStart: () => void;
  players: GamePlayerRow[];
}) {
  return (
    <div className="lobby">
      <h2>Waiting room</h2>
      <p className="lobby__hint">
        Share this code so friends can join:
      </p>
      <div className="lobby__code">{code}</div>
      <ul className="lobby__players">
        {players.map((p) => (
          <li key={p.id}>{p.display_name}</li>
        ))}
      </ul>
      {isHost ? (
        <button className="btn btn--primary" disabled={busy} onClick={onStart}>
          Start game
        </button>
      ) : (
        <p className="lobby__hint">Waiting for the host to start…</p>
      )}
    </div>
  );
}

function ScoreBoard({
  players,
  meId,
  winnerId,
}: {
  players: GamePlayerRow[];
  meId?: string;
  winnerId: string | null;
}) {
  const ranked = [...players].sort(
    (a, b) => b.card_count - a.card_count || b.dot_count - a.dot_count,
  );
  return (
    <aside className="scoreboard">
      <h3>Players</h3>
      <ul>
        {ranked.map((p) => (
          <li
            key={p.id}
            className={[
              p.id === meId ? 'is-me' : '',
              p.status === 'paused' ? 'is-paused' : '',
              p.user_id && p.user_id === winnerId ? 'is-winner' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <span className="scoreboard__name">
              {p.display_name}
              {p.id === meId && ' (you)'}
              {p.status === 'paused' && ' ⏸'}
            </span>
            <span className="scoreboard__score">
              {p.card_count}
              <span className="scoreboard__dots"> · {p.dot_count}d</span>
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function Results({
  players,
  winnerId,
  meId,
  onExit,
}: {
  players: GamePlayerRow[];
  winnerId: string | null;
  meId?: string;
  onExit: () => void;
}) {
  const ranked = [...players].sort(
    (a, b) => b.card_count - a.card_count || b.dot_count - a.dot_count,
  );
  const winner = players.find((p) => p.user_id && p.user_id === winnerId) ?? ranked[0];
  const iWon = winner?.id === meId;
  return (
    <div className="results">
      <h2>{iWon ? 'You win! 🎉' : `${winner?.display_name ?? 'Nobody'} wins`}</h2>
      <ol className="results__list">
        {ranked.map((p) => (
          <li key={p.id} className={p.id === meId ? 'is-me' : ''}>
            <span>{p.display_name}</span>
            <span>
              {p.card_count} cards · {p.dot_count} dots
            </span>
          </li>
        ))}
      </ol>
      <button className="btn btn--primary" onClick={onExit}>
        Back to menu
      </button>
    </div>
  );
}
