/** Multiplayer room: lobby -> active board -> results, driven by realtime state. */
import { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Table } from '../components/Table';
import { useGame } from '../hooks/useGame';
import { useTableKeyboard } from '../hooks/useTableKeyboard';
import { useAuth } from '../auth/AuthProvider';
import { claimGroup, leaveGame, restartGame, startGame } from '../lib/api';
import { popcount, type CardValue } from '../lib/xor';
import { BUY_URL } from '../lib/links';
import type { GamePlayerRow } from '../lib/database.types';
import './MultiplayerGame.css';

export interface MultiplayerGameProps {
  gameId: string;
  onExit: () => void;
}

export function MultiplayerGame({ gameId, onExit }: MultiplayerGameProps) {
  const { user } = useAuth();
  const { game, players, latestClaim, loading, intermission } = useGame(gameId);
  const [selected, setSelected] = useState<CardValue[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showValues, setShowValues] = useState(false);

  const me = useMemo(
    () => players.find((p) => p.user_id === user?.id) ?? null,
    [players, user],
  );
  const isHost = game?.host_id === user?.id;
  const paused = me?.status === 'paused';

  // Surface penalty/too-slow claim events as a brief toast. Successful claims
  // get the full intermission UI instead, so they're skipped here.
  useEffect(() => {
    if (!latestClaim) return;
    if (latestClaim.outcome === 'claimed' || latestClaim.outcome === 'claimed_final') return;
    const who = players.find((p) => p.id === latestClaim.player_id)?.display_name ?? 'Someone';
    const msg = latestClaim.outcome === 'penalty' ? `${who} mis-claimed — paused` : `${who} was too slow`;
    setToast(msg);
    const id = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(id);
  }, [latestClaim, players]);

  // Clear any stale selection when the table changes.
  useEffect(() => {
    setSelected((sel) => sel.filter((v) => game?.table_cards.includes(v)));
  }, [game?.table_cards]);

  // Drop the selection as soon as an intermission begins (the table freezes).
  useEffect(() => {
    if (intermission) setSelected([]);
  }, [intermission]);

  const claimerName = intermission
    ? (players.find((p) => p.id === intermission.claimedPlayerId)?.display_name ?? 'Someone')
    : null;

  const toggle = (v: CardValue) =>
    setSelected((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]));

  const doClaim = async () => {
    setBusy(true);
    try {
      const outcome = await claimGroup(gameId, selected);
      if (outcome === 'penalty') setToast('Not a XORO — you’re paused');
      else if (outcome === 'too_slow') setToast('Too slow — those cards were taken');
      setSelected([]);
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Claim failed');
    } finally {
      setBusy(false);
    }
  };

  // Any non-empty selection can be submitted; the server validates the math and
  // penalizes a bad claim. The UI must NOT gate on validity — that would make
  // the competitive penalty unreachable.
  const canClaim = !paused && !busy && selected.length > 0;

  // Keyboard controls. Card keys are live only while the board is interactive
  // (active round, no intermission, not paused); Enter mirrors the XORO! button.
  const { hoverIndex, clearHover } = useTableKeyboard({
    table: game?.table_cards ?? [],
    enabled: game?.status === 'active' && !intermission && !paused,
    toggle,
    canClaim,
    onClaim: doClaim,
  });

  if (loading || !game) {
    return <main className="mp mp--center">Loading game…</main>;
  }

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

  const doRestart = async () => {
    setBusy(true);
    try {
      await restartGame(gameId);
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Could not restart');
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
              {intermission && (
                <div className="mp__intermission">
                  {claimerName} got {intermission.claimedCards.length} card
                  {intermission.claimedCards.length === 1 ? '' : 's'}!
                </div>
              )}
              <Table
                table={intermission ? intermission.displayTable : game.table_cards}
                selected={intermission ? [] : selected}
                claimed={intermission?.claimedCards}
                showValues={showValues}
                hoveredIndex={intermission ? null : hoverIndex}
                onCardHover={clearHover}
                onToggle={intermission || paused ? undefined : toggle}
              />
              {paused && !intermission && (
                <div className="mp__paused">Paused — wait for the next valid XORO to rejoin.</div>
              )}
            </>
          )}

          {game.status === 'finished' && (
            <Results
              players={players}
              winnerId={game.winner_id}
              meId={me?.id}
              isHost={isHost}
              busy={busy}
              onRestart={doRestart}
              onExit={onExit}
            />
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
          <label className="mp__toggle">
            <input
              type="checkbox"
              checked={showValues}
              onChange={(e) => setShowValues(e.target.checked)}
            />
            Show numbers
          </label>
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
  // Build the join link off the host's current origin so it works across every
  // domain the app is served from (play.xor0game.com, play.xorogame.com, …).
  const joinUrl = `${window.location.origin}${import.meta.env.BASE_URL}?room=${code}`;
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
      <div className="lobby__qr">
        <QRCodeSVG className="lobby__qrcode" value={joinUrl} size={512} marginSize={2} />
        <p className="lobby__hint">Or scan to join from your phone</p>
      </div>
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
  isHost,
  busy,
  onRestart,
  onExit,
}: {
  players: GamePlayerRow[];
  winnerId: string | null;
  meId?: string;
  isHost: boolean;
  busy: boolean;
  onRestart: () => void;
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
      {isHost ? (
        <button className="btn btn--primary" disabled={busy} onClick={onRestart}>
          Play again
        </button>
      ) : (
        <p className="lobby__hint">Waiting for host to start next round…</p>
      )}
      <button className="btn btn--ghost" onClick={onExit}>
        Back to menu
      </button>
      <a
        className="btn btn--ghost"
        href={BUY_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        🛒 Buy the Game
      </a>
    </div>
  );
}
