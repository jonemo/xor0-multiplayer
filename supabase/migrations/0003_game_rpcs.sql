-- Xor0 multiplayer — the game-engine RPCs. All SECURITY DEFINER; clients call
-- these instead of writing the tables directly.

-- Max human players per room.
-- (kept inline as 6 below)

-- Unique short join code (avoids ambiguous chars).
create or replace function app.gen_code()
returns text language plpgsql as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text; -- not "code": would collide with games.code in the EXISTS below
  i int;
begin
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.games g where g.code = v_code);
  end loop;
  return v_code;
end;
$$;
grant execute on function app.gen_code() to authenticated;

-- Deal a fresh table for a difficulty: returns the shuffled deck, the cards to
-- place face up, and the resulting deck pointer (guaranteeing a group exists).
create or replace function app.deal(p_difficulty text, out deck int[], out table_cards int[], out deck_pointer int)
language plpgsql as $$
declare
  v_mask  int := app.difficulty_mask(p_difficulty);
  v_tsize int := app.table_size(p_difficulty);
begin
  deck := array(select g from generate_series(1, v_mask) g order by random());
  table_cards := '{}';
  deck_pointer := 0;
  while coalesce(array_length(table_cards, 1), 0) < v_tsize and deck_pointer < array_length(deck, 1) loop
    deck_pointer := deck_pointer + 1;
    table_cards := array_append(table_cards, deck[deck_pointer]);
  end loop;
  while not app.has_group(table_cards) and deck_pointer < array_length(deck, 1) loop
    deck_pointer := deck_pointer + 1;
    table_cards := array_append(table_cards, deck[deck_pointer]);
  end loop;
end;
$$;
grant execute on function app.deal(text) to authenticated;

-- Create a new game (lobby) and seat the host.
create or replace function public.create_game(p_difficulty text, p_visibility text default 'private')
returns public.games
language plpgsql security definer set search_path = public, app as $$
declare
  v_uid uuid := auth.uid();
  v_deal record;
  v_game public.games;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_difficulty not in ('easy','medium','normal','master') then raise exception 'bad difficulty'; end if;
  if p_visibility not in ('private','public') then raise exception 'bad visibility'; end if;

  select * into v_deal from app.deal(p_difficulty);

  insert into public.games (code, visibility, status, difficulty, mode, table_size, deck_order, deck_pointer, table_cards, host_id)
  values (app.gen_code(), p_visibility, 'lobby', p_difficulty, 'multiplayer',
          app.table_size(p_difficulty), v_deal.deck, v_deal.deck_pointer, v_deal.table_cards, v_uid)
  returning * into v_game;

  insert into public.game_players (game_id, user_id, seat, display_name)
  values (v_game.id, v_uid, 0, app.display_name(v_uid));

  return v_game;
end;
$$;
grant execute on function public.create_game(text, text) to authenticated;

-- Join a game by code. Idempotent for players already seated.
create or replace function public.join_game(p_code text)
returns public.games
language plpgsql security definer set search_path = public, app as $$
declare
  v_uid uuid := auth.uid();
  v_game public.games;
  v_seat int;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select * into v_game from public.games where code = upper(p_code) for update;
  if not found then raise exception 'no such game'; end if;
  if exists (select 1 from public.game_players where game_id = v_game.id and user_id = v_uid) then
    return v_game; -- already joined
  end if;
  if v_game.status <> 'lobby' then raise exception 'game already started'; end if;
  select coalesce(max(seat) + 1, 0) into v_seat from public.game_players where game_id = v_game.id;
  if v_seat >= 6 then raise exception 'room full'; end if;

  insert into public.game_players (game_id, user_id, seat, display_name)
  values (v_game.id, v_uid, v_seat, app.display_name(v_uid));
  return v_game;
end;
$$;
grant execute on function public.join_game(text) to authenticated;

-- Quick match: join an open public lobby for this difficulty, else create one.
create or replace function public.join_quick_match(p_difficulty text)
returns public.games
language plpgsql security definer set search_path = public, app as $$
declare
  v_uid uuid := auth.uid();
  v_game public.games;
  v_seat int;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select g.* into v_game
  from public.games g
  where g.visibility = 'public' and g.status = 'lobby' and g.difficulty = p_difficulty
    and (select count(*) from public.game_players p where p.game_id = g.id) < 6
    and not exists (select 1 from public.game_players p where p.game_id = g.id and p.user_id = v_uid)
  order by g.created_at asc
  limit 1
  for update skip locked;

  if not found then
    return public.create_game(p_difficulty, 'public');
  end if;

  select coalesce(max(seat) + 1, 0) into v_seat from public.game_players where game_id = v_game.id;
  insert into public.game_players (game_id, user_id, seat, display_name)
  values (v_game.id, v_uid, v_seat, app.display_name(v_uid));
  return v_game;
end;
$$;
grant execute on function public.join_quick_match(text) to authenticated;

-- Host starts the game.
create or replace function public.start_game(p_game_id uuid)
returns public.games
language plpgsql security definer set search_path = public, app as $$
declare
  v_game public.games;
begin
  select * into v_game from public.games where id = p_game_id for update;
  if not found then raise exception 'no such game'; end if;
  if v_game.host_id <> auth.uid() then raise exception 'only the host can start'; end if;
  if v_game.status <> 'lobby' then raise exception 'already started'; end if;
  update public.games set status = 'active', started_at = now(), updated_at = now()
  where id = p_game_id returning * into v_game;
  return v_game;
end;
$$;
grant execute on function public.start_game(uuid) to authenticated;

-- Leave a game. If the host leaves a lobby, the game is abandoned (finished).
create or replace function public.leave_game(p_game_id uuid)
returns void
language plpgsql security definer set search_path = public, app as $$
declare
  v_uid uuid := auth.uid();
  v_game public.games;
begin
  select * into v_game from public.games where id = p_game_id for update;
  if not found then return; end if;
  delete from public.game_players where game_id = p_game_id and user_id = v_uid;
  if v_game.host_id = v_uid and v_game.status = 'lobby' then
    update public.games set status = 'finished', finished_at = now(), updated_at = now()
    where id = p_game_id;
  end if;
end;
$$;
grant execute on function public.leave_game(uuid) to authenticated;

-- THE CORE: claim a group. Row-locks the game so concurrent claims serialize.
-- Returns jsonb { outcome }:
--   'penalty'      -> wrong math (XOR != 0 / <3 / dups): claimer is paused
--   'too_slow'     -> valid group but a card was already taken: no penalty
--   'claimed'      -> success; cards awarded, table replenished, others unpaused
--   'claimed_final'-> success and the deck is now exhausted -> game finished
create or replace function public.claim_group(p_game_id uuid, p_values int[])
returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare
  v_uid uuid := auth.uid();
  v_game public.games;
  v_player public.game_players;
  v_present boolean;
  v_new_table int[];
  v_ptr int;
  v_tsize int;
  v_size int := coalesce(array_length(p_values, 1), 0);
  v_distinct int;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select * into v_game from public.games where id = p_game_id for update; -- serialize claims
  if not found then raise exception 'no such game'; end if;
  if v_game.status <> 'active' then raise exception 'game is not active'; end if;

  select * into v_player from public.game_players where game_id = p_game_id and user_id = v_uid;
  if not found then raise exception 'not in this game'; end if;
  if v_player.status = 'paused' then raise exception 'you are paused'; end if;

  select count(distinct x) into v_distinct from unnest(p_values) x;

  -- 1) Validate the math first. Wrong math => penalty.
  if v_size < 3 or v_distinct <> v_size or app.xor(p_values) <> 0 then
    update public.game_players set status = 'paused' where id = v_player.id;
    insert into public.claims (game_id, player_id, user_id, card_values, valid, outcome)
    values (p_game_id, v_player.id, v_uid, p_values, false, 'penalty');
    update public.games set updated_at = now() where id = p_game_id;
    return jsonb_build_object('outcome', 'penalty');
  end if;

  -- 2) Math is valid. Are all cards still on the table? If not, lost the race.
  select not exists (
    select 1 from unnest(p_values) x where not (x = any(v_game.table_cards))
  ) into v_present;
  if not v_present then
    insert into public.claims (game_id, player_id, user_id, card_values, valid, outcome)
    values (p_game_id, v_player.id, v_uid, p_values, true, 'too_slow');
    update public.games set updated_at = now() where id = p_game_id;
    return jsonb_build_object('outcome', 'too_slow');
  end if;

  -- 3) Success. Remove claimed cards; refill toward table size; ensure a group.
  v_new_table := array(select x from unnest(v_game.table_cards) x where not (x = any(p_values)));
  v_ptr := v_game.deck_pointer;
  v_tsize := v_game.table_size;
  while coalesce(array_length(v_new_table, 1), 0) < v_tsize and v_ptr < array_length(v_game.deck_order, 1) loop
    v_ptr := v_ptr + 1;
    v_new_table := array_append(v_new_table, v_game.deck_order[v_ptr]);
  end loop;
  while not app.has_group(v_new_table) and v_ptr < array_length(v_game.deck_order, 1) loop
    v_ptr := v_ptr + 1;
    v_new_table := array_append(v_new_table, v_game.deck_order[v_ptr]);
  end loop;

  update public.game_players set
    cards = cards || p_values,
    card_count = card_count + v_size,
    dot_count = dot_count + app.dots(p_values)
  where id = v_player.id;

  -- A valid claim ends every penalty (spec §7).
  update public.game_players set status = 'active' where game_id = p_game_id and status = 'paused';

  insert into public.claims (game_id, player_id, user_id, card_values, valid, outcome)
  values (p_game_id, v_player.id, v_uid, p_values, true, 'claimed');

  -- 4) End condition: deck exhausted and no group remains.
  if not app.has_group(v_new_table) and v_ptr >= array_length(v_game.deck_order, 1) then
    update public.games set
      table_cards = v_new_table, deck_pointer = v_ptr,
      status = 'finished', finished_at = now(), updated_at = now(),
      winner_id = (
        select user_id from public.game_players
        where game_id = p_game_id and user_id is not null
        order by card_count desc, dot_count desc limit 1
      )
    where id = p_game_id;
    return jsonb_build_object('outcome', 'claimed_final');
  end if;

  update public.games set table_cards = v_new_table, deck_pointer = v_ptr, updated_at = now()
  where id = p_game_id;
  return jsonb_build_object('outcome', 'claimed');
end;
$$;
grant execute on function public.claim_group(uuid, int[]) to authenticated;
