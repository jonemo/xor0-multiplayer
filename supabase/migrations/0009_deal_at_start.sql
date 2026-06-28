-- Move dealing to the lobby->active transition (start_game), making it the
-- single source of truth for dealing a game.
--
-- Previously create_game dealt the deck/table at creation time and start_game
-- was a pure status flip that depended on that deal already existing. restart_game
-- (0007) resets a room back to an empty lobby, which broke that implicit
-- "a lobby is always dealt" invariant -> the next round started with an empty
-- table ("play again" bug).
--
-- Fix the class of bug, not the instance: a lobby is now a not-yet-dealt room
-- (cards exist iff the game is active), and start_game is the only place that
-- deals. create_game and restart_game both leave the deck/table empty.

-- Create a new game (empty lobby) and seat the host. No deal happens here; the
-- deck/table are dealt when the host starts the game.
create or replace function public.create_game(p_difficulty text, p_visibility text default 'private')
returns public.games
language plpgsql security definer set search_path = public, app as $$
declare
  v_uid uuid := auth.uid();
  v_game public.games;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_difficulty not in ('easy','medium','normal','master') then raise exception 'bad difficulty'; end if;
  if p_visibility not in ('private','public') then raise exception 'bad visibility'; end if;

  insert into public.games (code, visibility, status, difficulty, mode, table_size, deck_order, deck_pointer, table_cards, host_id)
  values (app.gen_code(), p_visibility, 'lobby', p_difficulty, 'multiplayer',
          app.table_size(p_difficulty), '{}', 0, '{}', v_uid)
  returning * into v_game;

  insert into public.game_players (game_id, user_id, seat, display_name)
  values (v_game.id, v_uid, 0, app.display_name(v_uid));

  return v_game;
end;
$$;
grant execute on function public.create_game(text, text) to authenticated;

-- Host starts the game: deal a fresh shuffled deck + starting table, then flip
-- the room to active. This is the single place a game gets dealt.
create or replace function public.start_game(p_game_id uuid)
returns public.games
language plpgsql security definer set search_path = public, app as $$
declare
  v_game public.games;
  v_deal record;
begin
  select * into v_game from public.games where id = p_game_id for update;
  if not found then raise exception 'no such game'; end if;
  if v_game.host_id <> auth.uid() then raise exception 'only the host can start'; end if;
  if v_game.status <> 'lobby' then raise exception 'already started'; end if;

  select * into v_deal from app.deal(v_game.difficulty);

  update public.games set
    status       = 'active',
    deck_order   = v_deal.deck,
    deck_pointer = v_deal.deck_pointer,
    table_cards  = v_deal.table_cards,
    started_at   = now(),
    updated_at   = now()
  where id = p_game_id returning * into v_game;
  return v_game;
end;
$$;
grant execute on function public.start_game(uuid) to authenticated;
