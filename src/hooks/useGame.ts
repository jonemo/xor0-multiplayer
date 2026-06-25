/**
 * Subscribes to a multiplayer game's realtime state: the game row, its players,
 * and the latest claim event (for animations/toasts). The authoritative writes
 * happen via RPCs (src/lib/api.ts); this hook only reads + listens.
 */
import { useEffect, useRef, useState } from 'react';
import { getSupabase } from '../lib/supabase';
import { fetchGameById, fetchPlayers } from '../lib/api';
import type { ClaimRow, GamePlayerRow, GameRow } from '../lib/database.types';

export interface GameView {
  game: GameRow | null;
  players: GamePlayerRow[];
  latestClaim: ClaimRow | null;
  loading: boolean;
  error: string | null;
}

export function useGame(gameId: string | null): GameView {
  const [game, setGame] = useState<GameRow | null>(null);
  const [players, setPlayers] = useState<GamePlayerRow[]>([]);
  const [latestClaim, setLatestClaim] = useState<ClaimRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reloadPlayers = useRef<() => void>(() => {});

  useEffect(() => {
    const supabase = getSupabase();
    if (!gameId || !supabase) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);

    const loadPlayers = async () => {
      const p = await fetchPlayers(gameId);
      if (active) setPlayers(p);
    };
    reloadPlayers.current = loadPlayers;

    // Initial snapshot.
    Promise.all([fetchGameById(gameId), fetchPlayers(gameId)])
      .then(([g, p]) => {
        if (!active) return;
        setGame(g);
        setPlayers(p);
        setLoading(false);
      })
      .catch((e) => active && setError(String(e)));

    // Realtime: game row, players, and claim inserts for this game.
    const channel = supabase
      .channel(`game:${gameId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
        (payload) => active && setGame(payload.new as GameRow),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${gameId}` },
        () => loadPlayers(),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'claims', filter: `game_id=eq.${gameId}` },
        (payload) => active && setLatestClaim(payload.new as ClaimRow),
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  return { game, players, latestClaim, loading, error };
}
