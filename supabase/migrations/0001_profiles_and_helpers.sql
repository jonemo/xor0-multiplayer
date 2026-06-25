-- Xor0 multiplayer — profiles + private helper functions.
--
-- Helpers live in a private `app` schema so they are NOT exposed as PostgREST
-- RPC endpoints (only `public` is exposed). The user-facing RPCs in 0003 live
-- in `public` and call these.

create schema if not exists app;
grant usage on schema app to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Pure game math (mirrors src/lib/xor.ts)
-- ---------------------------------------------------------------------------

-- Number of set bits in a 6-bit card value = number of dots.
create or replace function app.popcount(v int)
returns int language sql immutable as $$
  select (select count(*) from generate_series(0, 5) g where ((v >> g) & 1) = 1)::int;
$$;

-- XOR of a group of card values. Zero iff every color appears an even count.
create or replace function app.xor(vals int[])
returns int language sql immutable as $$
  select coalesce(bit_xor(x), 0)::int
  from unnest(coalesce(vals, '{}'::int[])) as t(x);
$$;

-- Total dots across a group.
create or replace function app.dots(vals int[])
returns int language sql immutable as $$
  select coalesce(sum(app.popcount(x)), 0)::int
  from unnest(coalesce(vals, '{}'::int[])) as t(x);
$$;

-- Active color bitmask + face-up table size per difficulty (spec §8).
create or replace function app.difficulty_mask(d text)
returns int language sql immutable as $$
  select case d
    when 'easy' then 7 when 'medium' then 15 when 'normal' then 31 when 'master' then 63
  end;
$$;

create or replace function app.table_size(d text)
returns int language sql immutable as $$
  select case d
    when 'easy' then 4 when 'medium' then 5 when 'normal' then 6 when 'master' then 7
  end;
$$;

-- Does the table contain ANY valid Xor0 group (>= 3 cards XOR-ing to 0)?
--
-- All cards are distinct and non-zero, so a zero-sum subset exists iff the card
-- vectors are linearly DEPENDENT over GF(2); the minimal such subset is always
-- size >= 3 (no zero card -> not 1; no duplicates -> not 2). So we just compare
-- the count of cards to their GF(2) rank, computed by Gaussian elimination over
-- the 6 bit positions. O(n * 6).
create or replace function app.has_group(vals int[])
returns boolean language plpgsql immutable as $$
declare
  pivots int[] := array[0,0,0,0,0,0]; -- pivots[i+1] holds a basis vector with top bit i
  x int;
  i int;
  rank int := 0;
  cnt int := 0;
begin
  foreach x in array coalesce(vals, '{}'::int[]) loop
    cnt := cnt + 1;
    for i in reverse 5..0 loop
      if ((x >> i) & 1) = 1 then
        if pivots[i + 1] = 0 then
          pivots[i + 1] := x;   -- x's highest set bit is i here -> new basis vector
          rank := rank + 1;
          x := 0;
          exit;
        else
          x := x # pivots[i + 1]; -- clear bit i, keep reducing
        end if;
      end if;
    end loop;
  end loop;
  return cnt > rank;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Display names are public (shown to other players); writes are owner-only.
create policy "profiles are readable by everyone"
  on public.profiles for select using (true);
create policy "users insert their own profile"
  on public.profiles for insert with check (user_id = auth.uid());
create policy "users update their own profile"
  on public.profiles for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Auto-create a profile (with a fun default name) when a user signs up,
-- including anonymous sign-ins.
create or replace function app.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, app as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, 'Player ' || lpad((floor(random() * 10000))::int::text, 4, '0'))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();

-- Look up a display name (security definer so RPCs/policies can read it).
create or replace function app.display_name(p_uid uuid)
returns text language sql stable security definer set search_path = public, app as $$
  select coalesce((select display_name from public.profiles where user_id = p_uid), 'Player');
$$;

-- NOTE: app.is_member() is defined in 0002 (it references game_players).

grant execute on all functions in schema app to authenticated, anon;
