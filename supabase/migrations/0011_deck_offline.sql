-- Stop shipping the shuffled deck to clients.
--
-- The round's full shuffled deck lived in public.games as deck_order int[] +
-- deck_pointer int. Postgres RLS is row-level only, so the SELECT policy that lets
-- members (and anyone, for public games) read a game row exposed the deck too. Worse,
-- every game RPC `returns public.games`, so the deck also rode along in RPC return
-- values and in realtime UPDATE payloads. Since refill draws strictly forward from
-- deck_order, any client could read deck_order[deck_pointer+1 ..] and pre-compute every
-- future table state -> undetectable cheating in a real-time speed game.
--
-- Fix the foundation: move the deck into a dedicated table with deny-all RLS that no
-- client can read, and drop the columns from public.games entirely. The deck is then
-- absent from every channel (direct select, RPC return, realtime) for free. Only the
-- SECURITY DEFINER RPCs (which run as the table owner and bypass RLS) touch it.

-- 1) Hidden deck table. RLS on, intentionally NO policies => deny-all for anon and
--    authenticated. Privileges revoked as belt-and-suspenders. NOT added to the
--    supabase_realtime publication, so it is never broadcast.
create table public.game_decks (
  game_id      uuid primary key references public.games(id) on delete cascade,
  deck_order   int[] not null,
  deck_pointer int   not null default 0
);
alter table public.game_decks enable row level security;
revoke all on public.game_decks from anon, authenticated;

-- 2) Migrate any in-flight decks (only active games have a live deck; lobbies are
--    not-yet-dealt and finished games are done), then drop the columns from games.
insert into public.game_decks (game_id, deck_order, deck_pointer)
select id, deck_order, deck_pointer
from public.games
where status = 'active';

alter table public.games drop column deck_order, drop column deck_pointer;

-- 3) Recreate the RPCs that referenced the deck. Behavior is identical to before;
--    only the storage location of deck_order/deck_pointer changes.

-- create_game: empty lobby, no deck yet (dealt at start). Same as 0009 minus the
-- deck columns, which no longer exist on public.games.
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

  insert into public.games (code, visibility, status, difficulty, mode, table_size, table_cards, host_id)
  values (app.gen_code(), p_visibility, 'lobby', p_difficulty, 'multiplayer',
          app.table_size(p_difficulty), '{}', v_uid)
  returning * into v_game;

  insert into public.game_players (game_id, user_id, seat, display_name)
  values (v_game.id, v_uid, 0, app.display_name(v_uid));

  return v_game;
end;
$$;
grant execute on function public.create_game(text, text) to authenticated;

-- start_game: deal a fresh deck, store it in game_decks, flip the room to active.
-- Single source of truth for dealing. Upsert so restart -> start re-deals cleanly.
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

  insert into public.game_decks (game_id, deck_order, deck_pointer)
  values (p_game_id, v_deal.deck, v_deal.deck_pointer)
  on conflict (game_id) do update
    set deck_order = excluded.deck_order, deck_pointer = excluded.deck_pointer;

  update public.games set
    status       = 'active',
    table_cards  = v_deal.table_cards,
    started_at   = now(),
    updated_at   = now()
  where id = p_game_id returning * into v_game;
  return v_game;
end;
$$;
grant execute on function public.start_game(uuid) to authenticated;

-- THE CORE: claim a group. Row-locks the game so concurrent claims serialize.
-- Returns jsonb { outcome }:
--   'penalty'      -> wrong math (XOR != 0 / <3 / dups): claimer is paused
--   'too_slow'     -> valid group but a card was already taken: no penalty
--   'claimed'      -> success; cards awarded, table replenished, others unpaused
--   'claimed_final'-> success and the deck is now exhausted -> game finished
-- (Body == 0006, with the deck now read from / written to public.game_decks.)
create or replace function public.claim_group(p_game_id uuid, p_values int[])
returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare
  v_uid uuid := auth.uid();
  v_game public.games;
  v_player public.game_players;
  v_present boolean;
  v_new_table int[];
  v_deck int[];
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
  --    The deck lives in game_decks; lock its row too (claims already serialize on the
  --    games lock above, so this is belt-and-suspenders).
  select deck_order, deck_pointer into v_deck, v_ptr
  from public.game_decks where game_id = p_game_id for update;

  v_new_table := array(select x from unnest(v_game.table_cards) x where not (x = any(p_values)));
  v_tsize := v_game.table_size;
  while coalesce(array_length(v_new_table, 1), 0) < v_tsize and v_ptr < array_length(v_deck, 1) loop
    v_ptr := v_ptr + 1;
    v_new_table := array_append(v_new_table, v_deck[v_ptr]);
  end loop;
  while not app.has_group(v_new_table) and v_ptr < array_length(v_deck, 1) loop
    v_ptr := v_ptr + 1;
    v_new_table := array_append(v_new_table, v_deck[v_ptr]);
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

  update public.game_decks set deck_pointer = v_ptr where game_id = p_game_id;

  -- 4) End condition: deck exhausted (remaining table cards are always a valid
  --    group, so the round ends immediately rather than making players race for it).
  if v_ptr >= array_length(v_deck, 1) then
    update public.games set
      table_cards = v_new_table,
      status = 'finished', finished_at = now(), updated_at = now(),
      winner_id = (
        select user_id from public.game_players
        where game_id = p_game_id and user_id is not null
        order by card_count desc, dot_count desc limit 1
      )
    where id = p_game_id;
    return jsonb_build_object('outcome', 'claimed_final');
  end if;

  update public.games set table_cards = v_new_table, updated_at = now()
  where id = p_game_id;
  return jsonb_build_object('outcome', 'claimed');
end;
$$;
grant execute on function public.claim_group(uuid, int[]) to authenticated;

-- restart_game: reset a finished room back to a not-yet-dealt lobby. Drop the deck row
-- (start_game re-creates it via upsert). Keeps search_path = '' -> fully-qualify names.
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

  delete from public.game_decks where game_id = p_game_id;

  update public.games set
    status      = 'lobby',
    winner_id   = null,
    started_at  = null,
    finished_at = null,
    table_cards = '{}',
    updated_at  = now()
  where id = p_game_id
  returning * into v_game;

  return v_game;
end;
$$;
revoke execute on function public.restart_game(uuid) from anon;
grant  execute on function public.restart_game(uuid) to authenticated;
