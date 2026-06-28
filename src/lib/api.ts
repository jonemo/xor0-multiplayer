/** Thin typed wrappers around the Supabase RPCs and reads. */
import { requireSupabase } from './supabase';
import type { GameRow, GamePlayerRow } from './database.types';
import type { CardValue, Difficulty } from './xor';
import type { SoloScore } from './solo';

export type ClaimOutcome = 'claimed' | 'claimed_final' | 'too_slow' | 'penalty';

export async function createGame(
  difficulty: Difficulty,
  visibility: 'private' | 'public' = 'private',
): Promise<GameRow> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('create_game', {
    p_difficulty: difficulty,
    p_visibility: visibility,
  });
  if (error) throw new Error(error.message);
  return data as GameRow;
}

export async function joinGame(code: string): Promise<GameRow> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('join_game', { p_code: code.trim().toUpperCase() });
  if (error) throw new Error(error.message);
  return data as GameRow;
}

export async function quickMatch(difficulty: Difficulty): Promise<GameRow> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('join_quick_match', { p_difficulty: difficulty });
  if (error) throw new Error(error.message);
  return data as GameRow;
}

export async function startGame(gameId: string): Promise<GameRow> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('start_game', { p_game_id: gameId });
  if (error) throw new Error(error.message);
  return data as GameRow;
}

export async function restartGame(gameId: string): Promise<GameRow> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('restart_game', { p_game_id: gameId });
  if (error) throw new Error(error.message);
  return data as GameRow;
}

export async function leaveGame(gameId: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc('leave_game', { p_game_id: gameId });
  if (error) throw new Error(error.message);
}

export async function claimGroup(
  gameId: string,
  values: CardValue[],
): Promise<ClaimOutcome> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('claim_group', { p_game_id: gameId, p_values: values });
  if (error) throw new Error(error.message);
  return (data as { outcome: ClaimOutcome }).outcome;
}

// Explicit column list (never the deck — it no longer lives on `games`, see
// migration 0011). Keeping the projection explicit documents what the client needs
// and guards against a future column accidentally being shipped to players.
const GAME_COLUMNS =
  'id, code, visibility, status, difficulty, mode, table_size, table_cards, host_id, winner_id, created_at, started_at, finished_at, updated_at' as const;

export async function fetchGameById(gameId: string): Promise<GameRow | null> {
  const sb = requireSupabase();
  const { data } = await sb.from('games').select(GAME_COLUMNS).eq('id', gameId).maybeSingle();
  return data ?? null;
}

export async function fetchPlayers(gameId: string): Promise<GamePlayerRow[]> {
  const sb = requireSupabase();
  const { data } = await sb
    .from('game_players')
    .select('*')
    .eq('game_id', gameId)
    .order('seat', { ascending: true });
  return data ?? [];
}

/** Persist a finished solo game to the global leaderboard. Best-effort. */
export async function recordSoloScoreRemote(userId: string, score: SoloScore): Promise<void> {
  const sb = requireSupabase();
  await sb.from('solo_scores').insert({
    user_id: userId,
    difficulty: score.difficulty,
    time_ms: score.timeMs,
    cards: score.cards,
    dots: score.dots,
  });
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  timeMs: number;
  cards: number;
  dots: number;
}

/** Top entries (best run per player) for a difficulty. */
export async function fetchLeaderboard(
  difficulty: Difficulty,
  limit = 20,
): Promise<LeaderboardEntry[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('get_solo_leaderboard', {
    p_difficulty: difficulty,
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    userId: r.user_id,
    displayName: r.display_name,
    timeMs: r.time_ms,
    cards: r.cards,
    dots: r.dots,
  }));
}
