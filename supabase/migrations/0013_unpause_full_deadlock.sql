-- 0013_unpause_full_deadlock.sql
--
-- Spec §7 says a wrong claim pauses a player until the *next valid claim*
-- un-pauses everyone. Edge case the spec omits (human players resolve it
-- socially): if every active player mis-claims in succession, ALL players end
-- up paused. A paused player is forbidden from claiming, so nobody can ever
-- produce the valid claim that would un-pause the table -> the round deadlocks.
--
-- This redefines claim_group (body == 0011) and adds one check to the penalty
-- branch: if a wrong guess just paused the last active player, un-pause everyone
-- so play can continue. All-paused can only arise here, the penalty branch being
-- the sole place status is set to 'paused'.
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
    -- If that wrong guess paused the last active player, no one could ever claim
    -- the next valid group (paused players can't claim), so the round would
    -- deadlock. Un-pause everyone to let play continue. (spec §7 gap)
    if not exists (
      select 1 from public.game_players
      where game_id = p_game_id and status = 'active'
    ) then
      update public.game_players set status = 'active' where game_id = p_game_id;
    end if;
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
