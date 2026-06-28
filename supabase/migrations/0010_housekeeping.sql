-- Xor0 multiplayer — periodic housekeeping.
--
-- Anonymous guests and abandoned games accumulate forever otherwise. We purge:
--   * stale lobbies      — never started, older than 12h (by created_at; the
--                          join_* RPCs don't bump updated_at, so created_at is
--                          the only reliable "lobby age").
--   * abandoned active   — no activity for 24h (every claim_group bumps
--                          updated_at, so it is a true last-activity marker).
--   * stale anon users   — anonymous auth.users, >90 days old, no sign-in for
--                          90 days, and not tied to any live game.
--
-- Finished games are kept on purpose (results / "play again"). Note: a finished
-- game HOSTED by a purged anon user still disappears via the host_id cascade.
--
-- Deletes lean on existing ON DELETE CASCADE FKs: games -> game_players + claims;
-- auth.users -> profiles, solo_scores, hosted games, game_players (claims.user_id
-- is set null, preserving claim history).
--
-- Functions live in the private `app` schema (not exposed as PostgREST RPCs) and
-- are run by pg_cron, not by clients.

create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- Purge functions
-- ---------------------------------------------------------------------------

create or replace function app.purge_stale_games()
returns void language sql security definer set search_path = public, app as $$
  delete from public.games
  where (status = 'lobby'  and created_at < now() - interval '12 hours')
     or (status = 'active' and updated_at < now() - interval '24 hours');
$$;

create or replace function app.purge_stale_anon_users()
returns void language sql security definer set search_path = public, app as $$
  delete from auth.users u
  where u.is_anonymous = true
    and u.created_at < now() - interval '90 days'
    and coalesce(u.last_sign_in_at, u.created_at) < now() - interval '90 days'
    and not exists (
      select 1 from public.games g
      where g.host_id = u.id and g.status in ('lobby','active')
    )
    and not exists (
      select 1 from public.game_players gp
      join public.games g on g.id = gp.game_id
      where gp.user_id = u.id and g.status in ('lobby','active')
    );
$$;

-- Housekeeping is internal-only. New functions default to EXECUTE for PUBLIC;
-- revoke it so clients can never call these even if the schema were exposed.
revoke all on function app.purge_stale_games()      from public, anon, authenticated;
revoke all on function app.purge_stale_anon_users() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Schedule (cron.schedule upserts by job name, so re-applying is safe)
-- ---------------------------------------------------------------------------

select cron.schedule('purge-stale-games',      '7 * * * *',  $$ select app.purge_stale_games(); $$);
select cron.schedule('purge-stale-anon-users', '23 3 * * *', $$ select app.purge_stale_anon_users(); $$);
