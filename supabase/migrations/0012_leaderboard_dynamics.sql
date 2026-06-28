-- Xor0 multiplayer — leaderboard dynamics.
--
-- Three changes to the solo leaderboard:
--   1. Hide anonymous guests' scores. A guest's runs are still recorded (same
--      user_id is kept when they later claim an account), but they only surface
--      on the public board once the account is non-anonymous. Filtering happens at
--      READ time on the current auth.users.is_anonymous, so claiming retroactively
--      reveals past runs. Reading auth.users requires SECURITY DEFINER (the
--      function was SECURITY INVOKER before).
--   2. Track incorrect guesses per run (transparency; possible scoring penalty
--      later). New solo_scores.incorrect_guesses column, surfaced in the read.
--   3. Time-bounded views. The function takes a raw p_since timestamptz cutoff
--      (null = all-time); the set of offered windows (24h/7d/90d/…) is a frontend
--      concern, so changing them never needs a new migration.

alter table public.solo_scores
  add column if not exists incorrect_guesses int not null default 0;

-- Return shape + signature change, so replace rather than create-or-replace.
drop function if exists public.get_solo_leaderboard(text, int);

create function public.get_solo_leaderboard(
  p_difficulty text,
  p_since      timestamptz default null,  -- null = all-time; else a client cutoff
  p_limit      int default 20
)
returns table (
  user_id           uuid,
  display_name      text,
  time_ms           int,
  cards             int,
  dots              int,
  incorrect_guesses int,
  created_at        timestamptz
)
language sql stable
security definer            -- needed to read auth.users.is_anonymous (by design)
set search_path = ''
as $$
  select b.user_id, b.display_name, b.time_ms, b.cards, b.dots,
         b.incorrect_guesses, b.created_at
  from (
    select distinct on (s.user_id)
      s.user_id,
      coalesce(p.display_name, 'Player') as display_name,
      s.time_ms, s.cards, s.dots, s.incorrect_guesses, s.created_at
    from public.solo_scores s
    join auth.users u
      on u.id = s.user_id and coalesce(u.is_anonymous, false) = false
    left join public.profiles p on p.user_id = s.user_id
    where s.difficulty = p_difficulty
      and (p_since is null or s.created_at >= p_since)
    order by s.user_id, s.cards desc, s.time_ms asc
  ) b
  order by b.cards desc, b.time_ms asc
  limit greatest(1, least(p_limit, 100));
$$;

grant execute on function public.get_solo_leaderboard(text, timestamptz, int)
  to authenticated, anon;
