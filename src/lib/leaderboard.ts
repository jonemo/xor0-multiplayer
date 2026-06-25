/**
 * Local solo-score persistence (best times per difficulty).
 *
 * Phase 1 stores results in localStorage. Once auth + the `solo_scores` table
 * land (Phase 2/3), `recordSoloScore` will additionally upsert to Supabase for
 * a global leaderboard — see TODO below.
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

  // TODO(Phase 2/3): if authed + Supabase configured, insert into `solo_scores`.
  return isBetter;
}
