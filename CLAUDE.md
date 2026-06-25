# CLAUDE.md

Guidance for working in this repo. Read this first.

## What this is

Online multiplayer version of the tabletop game **Xor0**, linked from xor0game.com.
- **Live:** https://play.xor0game.com/ (GitHub Pages, auto-deploys on push to `main`)
- **Repo:** `jonemo/xor0-multiplayer` (note: the local folder is misspelled `xoro-multiplayer`; the repo/product is `xor0`)
- **Game rule:** each card is a 6-bit integer 1–63 = sum of its colored dots. A valid **XORO!** play is any set of ≥3 face-up cards whose values XOR to 0. Most cards wins; ties broken by most dots. Full spec: `xor0_instructions.md`.

## Stack

- **Frontend:** Vite + React 18 + TypeScript (static SPA). Tests: Vitest.
- **Backend:** Supabase — anonymous auth, Postgres (authoritative game state via `SECURITY DEFINER` RPCs), Realtime (Postgres Changes).
- No app server of our own; the browser talks directly to Supabase.

## Commands

```bash
npm install
npm run dev         # http://localhost:5173
npm test            # game-engine + local-game unit tests (Vitest)
npm run typecheck   # tsc -b --noEmit
npm run build       # tsc + vite build -> dist/
```

`.env` (gitignored) needs `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (the **publishable/anon** key — public-safe). See `.env.example`.

## Architecture — the important rules

1. **Postgres is the source of truth for multiplayer.** All mutations go through
   `SECURITY DEFINER` RPCs (`create_game`, `join_game`, `join_quick_match`,
   `start_game`, `leave_game`, `claim_group`). Clients have **read-only** RLS; they
   never write game tables directly. This makes claims atomic and cheat-resistant.

2. **`claim_group` is the core.** It row-locks the game (`SELECT … FOR UPDATE`) so
   concurrent claims serialize. Outcomes: `penalty` (bad math → claimer paused),
   `too_slow` (valid set but a card was already taken → **no** penalty), `claimed`
   / `claimed_final`. A valid claim un-pauses everyone (spec §7).

3. **The game engine is mirrored in TWO places that MUST stay in sync:**
   - `src/lib/xor.ts` — the TypeScript engine (UI, solo, AI).
   - `supabase/migrations/0001_*.sql` (`app.*` helpers) + `0003_*.sql` (`claim_group`)
     — the authoritative SQL engine.
   If you change game logic, change both. The SQL `app.has_group` uses GF(2) rank
   (a zero-XOR subset exists iff the card vectors are linearly dependent).

4. **Solo + solo-vs-AI are fully client-side** (no Supabase). AI bots run **in the
   browser only** — they can't drive real Supabase games because `claim_group`
   needs `auth.uid()`. See `src/lib/localGame.ts` + `src/hooks/useLocalGame.ts`.

5. **Realtime** = Postgres Changes on `games` / `game_players` / `claims`
   (`src/hooks/useGame.ts`). Authority is the RPC return value; realtime is for
   showing other players' updates.

## Project layout

```
src/lib/
  xor.ts          # game engine: value<->dots, popcount, isValidGroup, bestGroup,
                  #   DIFFICULTY configs, shuffle  (mirrored in SQL — keep in sync)
  cards.ts        # bit -> {position, color, hex} for procedural card rendering
  solo.ts         # pure solo timed-game state
  localGame.ts    # pure human-vs-AI (offline) game state
  api.ts          # typed wrappers around the Supabase RPCs + reads
  supabase.ts     # client (degrades gracefully if env not set)
  database.types.ts  # generated; regenerate via Supabase MCP generate_typescript_types
  leaderboard.ts  # solo best times (localStorage; Supabase TODO)
src/components/   # Card (procedural SVG), Table
src/screens/      # Home, SoloGame, AiGame, MultiplayerGame
src/hooks/        # useSoloGame, useLocalGame (bot timers), useGame (realtime)
src/auth/         # AuthProvider (anonymous sign-in + optional email link)
supabase/migrations/   # 0001 profiles+helpers, 0002 tables+RLS+realtime, 0003 RPCs,
                       #   0004 hardening, 0005 gen_code fix
.github/workflows/deploy.yml   # build + publish to GitHub Pages
design_files/, autosvg/        # card art + branding (reference; not all shipped)
```

## Database / Supabase

- Project ref: `gbsgoiyzzowgdjhsatmt`. Apply migrations via the **Supabase MCP**
  (`mcp__supabase__apply_migration`) or `supabase db push`. Migrations are in
  `supabase/migrations/` and are append-only (don't edit applied ones; add new).
- **Anonymous sign-ins must be enabled** in Auth → Sign In/Providers (already on).
- Helper functions live in a private `app` schema (not exposed as RPC endpoints);
  user-facing RPCs are in `public`. SQL functions pin `search_path`.
- Advisor note: the remaining `0029` "authenticated can execute SECURITY DEFINER"
  warnings are **by design** (that's how clients mutate safely) — don't "fix" them.

## Card rendering (bit → position → color)

Cards are rendered procedurally (`src/components/Card.tsx`), not from the 63 SVGs.

| bit | position      | color  | hex      |
|-----|---------------|--------|----------|
| 1   | bottom-left   | orange | #aa4400  |
| 2   | bottom-right  | blue   | #353d5f  |
| 4   | middle-left   | green  | #433e0e  |
| 8   | middle-right  | yellow | #c99600  |
| 16  | top-left      | teal   | #008080  |
| 32  | top-right     | red    | #800000  |

Each dot is labeled with its bit value, mirror-printed (upright + 180°), like the
physical cards. `autosvg/NN.svg` = card value NN (reference art).

## Deploy

- Push to `main` → `.github/workflows/deploy.yml` builds and publishes to Pages.
- Supabase env is injected from repo **Actions variables** (`gh variable list`).
- Custom domain `play.xor0game.com`: DNS CNAME `play` → `jonemo.github.io`; the
  domain is set in the **Pages config via API** (`gh api PUT …/pages -f cname=…`) —
  the `public/CNAME` file alone does NOT register it for Actions deploys. Vite
  `base: '/'`.

## Gotchas

- **AI bot tuning** lives in `SKILL` in `src/screens/AiGame.tsx`. Bots grab a set
  instantly once they decide, while a human must click 3–6 cards, so timings are
  deliberately slow (`baseMs` + `missChance`). Don't make them "instant optimal."
- **Playwright + Vite:** Playwright writes snapshots/screenshots into the repo,
  which Vite's watcher treats as source changes → full page reload (resets React
  state mid-test). `vite.config.ts` ignores `.playwright-mcp/**` and `*.png`; save
  screenshots under `.playwright-mcp/`.
- **Two-human multiplayer** needs two *isolated* browser sessions (separate auth);
  the Playwright MCP shares one context, so do that test manually / two browsers.
- When self-testing RPCs over SQL, you can insert throwaway `auth.users` and set
  `request.jwt.claims` to simulate users (see git history for the pattern); clean
  them up after.

## Conventions

- Match the surrounding code style. Game logic is exhaustive/exact (table ≤ 7, so
  brute-force subset search is fine and used intentionally).
- Commit messages: imperative subject; end with the Co-Authored-By trailer.
- Don't commit `.env`. Screenshots/test artifacts are gitignored.
