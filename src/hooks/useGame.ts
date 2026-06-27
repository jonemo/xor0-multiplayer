/**
 * Subscribes to a multiplayer game's realtime state: the game row, its players,
 * and the latest claim event (for animations/toasts). The authoritative writes
 * happen via RPCs (src/lib/api.ts); this hook only reads + listens.
 */
import { useEffect, useRef, useState } from 'react';
import { getSupabase } from '../lib/supabase';
import { fetchGameById, fetchPlayers } from '../lib/api';
import type { ClaimRow, GamePlayerRow, GameRow } from '../lib/database.types';

/**
 * A short pause shown after a successful claim so every player can see which
 * cards were taken before the table refills. The board is frozen on
 * `displayTable` (the pre-claim face-up cards) with `claimedCards` highlighted.
 */
export interface IntermissionState {
  claimedCards: number[];
  claimedPlayerId: string | null;
  displayTable: number[];
}

export interface GameView {
  game: GameRow | null;
  players: GamePlayerRow[];
  latestClaim: ClaimRow | null;
  intermission: IntermissionState | null;
  loading: boolean;
  error: string | null;
}

const INTERMISSION_MS = 3000;

export function useGame(gameId: string | null): GameView {
  const [game, setGame] = useState<GameRow | null>(null);
  const [players, setPlayers] = useState<GamePlayerRow[]>([]);
  const [latestClaim, setLatestClaim] = useState<ClaimRow | null>(null);
  const [intermission, setIntermission] = useState<IntermissionState | null>(null);
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

    // Refs let the realtime callbacks (stable closures) read current state and
    // coordinate the intermission without re-subscribing on every render.
    const gameRef = { current: null as GameRow | null };
    const prevTableRef = { current: [] as number[] }; // table just before the last UPDATE
    const pendingGameRef = { current: null as GameRow | null }; // UPDATE buffered during intermission
    const intermissionActiveRef = { current: false };
    let intermissionTimer: ReturnType<typeof setTimeout> | undefined;

    const setCurrentGame = (g: GameRow | null) => {
      gameRef.current = g;
      setGame(g);
    };

    const endIntermission = () => {
      intermissionActiveRef.current = false;
      if (active) setIntermission(null);
      if (pendingGameRef.current) {
        setCurrentGame(pendingGameRef.current);
        pendingGameRef.current = null;
      }
    };

    const loadPlayers = async () => {
      const p = await fetchPlayers(gameId);
      if (active) setPlayers(p);
    };
    reloadPlayers.current = loadPlayers;

    // Initial snapshot.
    Promise.all([fetchGameById(gameId), fetchPlayers(gameId)])
      .then(([g, p]) => {
        if (!active) return;
        setCurrentGame(g);
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
        (payload) => {
          if (!active) return;
          const newGame = payload.new as GameRow;
          prevTableRef.current = gameRef.current?.table_cards ?? [];
          gameRef.current = newGame;
          // During an intermission, hold the new table until it ends.
          if (intermissionActiveRef.current) {
            pendingGameRef.current = newGame;
          } else {
            setGame(newGame);
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${gameId}` },
        () => loadPlayers(),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'claims', filter: `game_id=eq.${gameId}` },
        (payload) => {
          if (!active) return;
          const claim = payload.new as ClaimRow;
          setLatestClaim(claim);
          if (claim.outcome !== 'claimed' && claim.outcome !== 'claimed_final') return;
          // Show the pre-claim table: it's still in `game` if the claims event
          // beat the games UPDATE, otherwise recover it from prevTableRef.
          const currentTable = gameRef.current?.table_cards ?? [];
          const stillPresent = claim.card_values.every((c) => currentTable.includes(c));
          const displayTable = stillPresent ? [...currentTable] : [...prevTableRef.current];
          intermissionActiveRef.current = true;
          setIntermission({
            claimedCards: claim.card_values,
            claimedPlayerId: claim.player_id,
            displayTable,
          });
          if (intermissionTimer) clearTimeout(intermissionTimer);
          intermissionTimer = setTimeout(endIntermission, INTERMISSION_MS);
        },
      )
      .subscribe();

    return () => {
      active = false;
      if (intermissionTimer) clearTimeout(intermissionTimer);
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  return { game, players, latestClaim, intermission, loading, error };
}
