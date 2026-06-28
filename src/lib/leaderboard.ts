/**
 * Local solo-score persistence (best times per difficulty).
 *
 * This stores the player's personal best in localStorage. The global leaderboard
 * is written separately from `useSoloGame` via `recordSoloScoreRemote` when the
 * player is signed in (anonymous or permanent).
 */
import type { Difficulty } from './xor';
import type { SoloScore } from './solo';

const KEY = 'xor0.solo.best.v1';

export interface BestEntry {
  timeMs: number;
  cards: number;
  dots: number;
  at: number;
}

type BestMap = Partial<Record<Difficulty, BestEntry>>;

function read(): BestMap {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as BestMap;
  } catch {
    return {};
  }
}

function write(map: BestMap): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

export function getBest(difficulty: Difficulty): BestEntry | undefined {
  return read()[difficulty];
}

/**
 * Record a finished game. "Best" = most cards, then fastest time. Returns true
 * if this run set a new personal best for its difficulty.
 */
export function recordSoloScore(score: SoloScore): boolean {
  const map = read();
  const prev = map[score.difficulty];
  const isBetter =
    !prev ||
    score.cards > prev.cards ||
    (score.cards === prev.cards && score.timeMs < prev.timeMs);

  if (isBetter) {
    map[score.difficulty] = {
      timeMs: score.timeMs,
      cards: score.cards,
      dots: score.dots,
      at: Date.now(),
    };
    write(map);
  }

  return isBetter;
}
