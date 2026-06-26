create or replace function public.restart_game(p_game_id uuid)
returns public.games
language plpgsql security definer
set search_path = ''
as $$
declare
  v_game public.games;
begin
  select * into v_game from public.games where id = p_game_id for update;
  if not found then raise exception 'game not found'; end if;
  if v_game.status <> 'finished' then raise exception 'game is not finished'; end if;
  if v_game.host_id <> auth.uid() then raise exception 'only the host can restart'; end if;

  update public.game_players
  set card_count = 0, dot_count = 0, cards = '{}', status = 'active'
  where game_id = p_game_id;

  update public.games set
    status      = 'lobby',
    winner_id   = null,
    started_at  = null,
    finished_at = null,
    table_cards  = '{}',
    deck_order   = '{}',
    deck_pointer = 0,
    updated_at   = now()
  where id = p_game_id
  returning * into v_game;

  return v_game;
end;
$$;

revoke execute on function public.restart_game(uuid) from anon;
grant  execute on function public.restart_game(uuid) to authenticated;
