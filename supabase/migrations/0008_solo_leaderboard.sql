-- Xor0 multiplayer — public solo leaderboard read.
--
-- One row per player: their BEST run for the given difficulty (most cards, then
-- fastest), joined to their display name. SECURITY INVOKER is fine because both
-- solo_scores and profiles are already public-read (see 0001/0002 RLS); the
-- function just saves clients a manual join (there's no FK solo_scores -> profiles
-- for PostgREST to auto-embed).

create or replace function public.get_solo_leaderboard(
  p_difficulty text,
  p_limit int default 20
)
returns table (
  user_id      uuid,
  display_name text,
  time_ms      int,
  cards        int,
  dots         int,
  created_at   timestamptz
)
language sql stable
set search_path = ''
as $$
  select b.user_id, b.display_name, b.time_ms, b.cards, b.dots, b.created_at
  from (
    select distinct on (s.user_id)
      s.user_id,
      coalesce(p.display_name, 'Player') as display_name,
      s.time_ms, s.cards, s.dots, s.created_at
    from public.solo_scores s
    left join public.profiles p on p.user_id = s.user_id
    where s.difficulty = p_difficulty
    order by s.user_id, s.cards desc, s.time_ms asc
  ) b
  order by b.cards desc, b.time_ms asc
  limit greatest(1, least(p_limit, 100));
$$;

grant execute on function public.get_solo_leaderboard(text, int) to authenticated, anon;
