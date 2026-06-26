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

export async function fetchGameById(gameId: string): Promise<GameRow | null> {
  const sb = requireSupabase();
  const { data } = await sb.from('games').select('*').eq('id', gameId).maybeSingle();
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
