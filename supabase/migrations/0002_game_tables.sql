-- Xor0 multiplayer — game tables, RLS, and realtime.
--
-- All game mutations happen through SECURITY DEFINER RPCs (0003); these tables
-- have NO direct insert/update/delete policies, so clients can only read.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.games (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,
  visibility   text not null default 'private' check (visibility in ('private','public')),
  status       text not null default 'lobby'   check (status in ('lobby','active','finished')),
  difficulty   text not null check (difficulty in ('easy','medium','normal','master')),
  mode         text not null default 'multiplayer' check (mode in ('multiplayer')),
  table_size   int  not null,
  deck_order   int[] not null,   -- shuffled deck for this difficulty
  deck_pointer int  not null default 0,
  table_cards  int[] not null default '{}', -- currently face-up values (no nulls)
  host_id      uuid not null references auth.users(id) on delete cascade,
  winner_id    uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  started_at   timestamptz,
  finished_at  timestamptz,
  updated_at   timestamptz not null default now()
);

create index games_status_visibility_idx on public.games (status, visibility);

create table public.game_players (
  id           uuid primary key default gen_random_uuid(),
  game_id      uuid not null references public.games(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete cascade, -- null for AI (Phase 4)
  seat         int  not null,
  is_ai        boolean not null default false,
  display_name text not null,
  cards        int[] not null default '{}',
  card_count   int  not null default 0,
  dot_count    int  not null default 0,
  status       text not null default 'active' check (status in ('active','paused')),
  joined_at    timestamptz not null default now(),
  unique (game_id, seat),
  unique (game_id, user_id)
);

create index game_players_game_idx on public.game_players (game_id);

create table public.claims (
  id          bigint generated always as identity primary key,
  game_id     uuid not null references public.games(id) on delete cascade,
  player_id   uuid references public.game_players(id) on delete set null,
  user_id     uuid references auth.users(id) on delete set null,
  card_values int[] not null,
  valid       boolean not null,
  outcome     text not null check (outcome in ('claimed','claimed_final','too_slow','penalty')),
  created_at  timestamptz not null default now()
);

create index claims_game_idx on public.claims (game_id, created_at);

create table public.solo_scores (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  difficulty text not null check (difficulty in ('easy','medium','normal','master')),
  time_ms    int not null,
  cards      int not null,
  dots       int not null,
  created_at timestamptz not null default now()
);

create index solo_scores_leaderboard_idx on public.solo_scores (difficulty, cards desc, time_ms asc);

-- ---------------------------------------------------------------------------
-- Membership helper (now that game_players exists) — used by RLS below.
-- SECURITY DEFINER avoids RLS recursion on game_players.
-- ---------------------------------------------------------------------------
create or replace function app.is_member(p_game uuid)
returns boolean language sql stable security definer set search_path = public, app as $$
  select exists (
    select 1 from public.game_players where game_id = p_game and user_id = auth.uid()
  );
$$;
grant execute on function app.is_member(uuid) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- RLS — read-only for clients; all writes go through RPCs.
-- ---------------------------------------------------------------------------
alter table public.games        enable row level security;
alter table public.game_players enable row level security;
alter table public.claims       enable row level security;
alter table public.solo_scores  enable row level security;

-- Games: visible if public (for discovery) or you're a member.
create policy "games visible to members or if public"
  on public.games for select
  using (visibility = 'public' or app.is_member(id));

-- Players: visible if you're a member of that game, or the game is public.
create policy "players visible to members or in public games"
  on public.game_players for select
  using (
    app.is_member(game_id)
    or exists (select 1 from public.games g where g.id = game_id and g.visibility = 'public')
  );

-- Claims: visible to members (drives the event feed/animations).
create policy "claims visible to members"
  on public.claims for select
  using (app.is_member(game_id));

-- Solo scores: public leaderboard; insert your own only.
create policy "solo scores are public"
  on public.solo_scores for select using (true);
create policy "users insert their own solo score"
  on public.solo_scores for insert with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Realtime — broadcast row changes to subscribed clients.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.games;
alter publication supabase_realtime add table public.game_players;
alter publication supabase_realtime add table public.claims;
