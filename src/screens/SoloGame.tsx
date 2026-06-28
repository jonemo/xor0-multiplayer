/** Solo timed game screen. */
import { useRef, useState } from 'react';
import { Table } from '../components/Table';
import { useSoloGame } from '../hooks/useSoloGame';
import { useTableKeyboard } from '../hooks/useTableKeyboard';
import { scoreOf } from '../lib/solo';
import { formatTime } from '../lib/format';
import { getBest } from '../lib/leaderboard';
import { DIFFICULTY, popcount, type Difficulty } from '../lib/xor';
import './SoloGame.css';

export interface SoloGameProps {
  difficulty: Difficulty;
  onExit: () => void;
}

export function SoloGame({ difficulty, onExit }: SoloGameProps) {
  const game = useSoloGame(difficulty);
  const { state, elapsedMs, selected } = game;
  const [showValues, setShowValues] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showHintWarning, setShowHintWarning] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  // The first hint of a game is warned about (it exempts the run from the
  // leaderboard); after the player acknowledges, further hints reveal directly.
  const onHint = () => {
    if (state.hintUsed) game.hint();
    else setShowHintWarning(true);
  };
  const confirmHint = () => {
    setShowHintWarning(false);
    game.hint();
  };

  // Solo has no penalty: a wrong claim just gets brief feedback, no time/score
  // cost (parallels multiplayer where the UI also never blocks a bad claim).
  const doClaim = () => {
    const result = game.claim();
    if (result === 'ok') return;
    const msg =
      result === 'not-on-table' ? 'Those cards aren’t on the table' : 'Not a valid XORO';
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  };

  const { hoverIndex, clearHover } = useTableKeyboard({
    table: state.table,
    enabled: state.status === 'playing',
    toggle: game.toggle,
    canClaim: game.canClaim,
    onClaim: doClaim,
  });

  const deckRemaining = state.deck.length - state.deckPointer;
  const dots = state.collected.reduce((sum, v) => sum + popcount(v), 0);
  const selectedDots = selected.reduce((sum, v) => sum + popcount(v), 0);

  return (
    <main className="solo">
      <header className="solo__bar">
        <button className="btn btn--ghost" onClick={onExit}>
          ← Menu
        </button>
        <div className="solo__stats">
          <Stat label="Time" value={formatTime(elapsedMs)} mono />
          <Stat label="Cards" value={String(state.collected.length)} />
          <Stat label="Dots" value={String(dots)} />
          <Stat label="Deck" value={String(deckRemaining)} />
          <Stat label="Level" value={DIFFICULTY[difficulty].label} />
        </div>
      </header>

      {toast && <div className="solo__toast">{toast}</div>}

      <section className="solo__board">
        <Table
          table={state.table}
          selected={selected}
          hinted={game.hinted}
          showValues={showValues}
          hoveredIndex={hoverIndex}
          onCardHover={clearHover}
          onToggle={state.status === 'playing' ? game.toggle : undefined}
        />
      </section>

      <footer className="solo__actions">
        <button
          className="btn btn--primary btn--xoro"
          disabled={!game.canClaim}
          onClick={doClaim}
        >
          XORO!{' '}
          {selected.length > 0 && (
            <span className="btn__sub">
              {selected.length} card{selected.length === 1 ? '' : 's'} · {selectedDots} dots
            </span>
          )}
        </button>
        <button className="btn btn--ghost" disabled={!selected.length} onClick={game.clearSelection}>
          Clear
        </button>
        <button className="btn btn--ghost" disabled={state.status !== 'playing'} onClick={onHint}>
          Hint{state.hintUsed && <span className="btn__sub">no leaderboard</span>}
        </button>
        <label className="solo__toggle">
          <input
            type="checkbox"
            checked={showValues}
            onChange={(e) => setShowValues(e.target.checked)}
          />
          Show numbers
        </label>
      </footer>

      {showHintWarning && (
        <div className="overlay">
          <div className="overlay__card">
            <h2>Use a hint?</h2>
            <p className="overlay__line">
              Hints reveal a valid XORO on the table. Using one in this game means the run
              won’t count toward your best times or the leaderboard.
            </p>
            <div className="overlay__actions">
              <button className="btn btn--primary" onClick={confirmHint}>
                Show hint
              </button>
              <button className="btn btn--ghost" onClick={() => setShowHintWarning(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {state.status === 'over' && (
        <GameOver
          difficulty={difficulty}
          summary={summarize(game)}
          onPlayAgain={() => game.newGame()}
          onExit={onExit}
        />
      )}
    </main>
  );
}

function summarize(game: ReturnType<typeof useSoloGame>) {
  const s = scoreOf(game.state);
  return { ...s, isBest: game.finishedBest === true, hintUsed: game.state.hintUsed };
}

function GameOver({
  difficulty,
  summary,
  onPlayAgain,
  onExit,
}: {
  difficulty: Difficulty;
  summary: ReturnType<typeof summarize>;
  onPlayAgain: () => void;
  onExit: () => void;
}) {
  const best = getBest(difficulty);
  const total = DIFFICULTY[difficulty].deckSize;
  return (
    <div className="overlay">
      <div className="overlay__card">
        <h2>Deck cleared!</h2>
        <p className="overlay__time">{formatTime(summary.timeMs)}</p>
        <p className="overlay__line">
          {summary.cards} / {total} cards · {summary.dots} dots
        </p>
        {summary.hintUsed ? (
          <p className="overlay__best">Hint used — this run doesn’t count toward the leaderboard.</p>
        ) : summary.isBest ? (
          <p className="overlay__best overlay__best--new">★ New personal best!</p>
        ) : best ? (
          <p className="overlay__best">
            Best: {formatTime(best.timeMs)} ({best.cards} cards)
          </p>
        ) : null}
        <div className="overlay__actions">
          <button className="btn btn--primary" onClick={onPlayAgain}>
            Play again
          </button>
          <button className="btn btn--ghost" onClick={onExit}>
            Change level
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="stat">
      <span className="stat__label">{label}</span>
      <span className={`stat__value${mono ? ' stat__value--mono' : ''}`}>{value}</span>
    </div>
  );
}
