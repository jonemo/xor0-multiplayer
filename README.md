# Xor0 — online multiplayer

An online version of the tabletop game **Xor0**, to be linked from
[xor0game.com](https://www.xor0game.com). Each card is a 6-bit integer (the sum of its
colored dots); a valid **XORO!** play is any set of ≥3 face-up cards whose values XOR to
zero. Most cards wins, ties broken by most dots.

## Stack

- **Frontend:** Vite + React + TypeScript (static SPA)
- **Backend:** Supabase — anonymous auth, Postgres (authoritative game state via
  `SECURITY DEFINER` RPCs), and Realtime for live table/score updates

## Modes

- **Solo · against the clock** — clear the deck as fast as you can (fully client-side)
- **Multiplayer** — private room codes + public quick-match, real-time races

## Develop

```bash
npm install
cp .env.example .env   # fill in your Supabase URL + anon/publishable key
npm run dev            # http://localhost:5173
npm test               # game-engine unit tests
npm run build          # production build -> dist/
```

## Database

Migrations live in `supabase/migrations/`. Apply them to a Supabase project with the
Supabase CLI (`supabase db push`) or the Supabase MCP server. Enable **Anonymous
sign-ins** under Authentication → Sign In / Providers.

The game engine is mirrored in two places that must stay in sync:

- `src/lib/xor.ts` — TypeScript engine (UI, solo mode)
- `supabase/migrations/0001_*.sql` + `0003_*.sql` — the authoritative SQL engine (`app.*`
  helpers and the `claim_group` RPC)

## Project layout

```
src/lib/        xor.ts (engine), solo.ts, cards.ts, api.ts, supabase.ts
src/components/  Card, Table
src/screens/     Home, SoloGame, MultiplayerGame
src/hooks/       useSoloGame, useGame (realtime)
src/auth/        AuthProvider (anonymous sign-in + optional email link)
supabase/migrations/   SQL schema, RLS, and RPCs
design_files/, autosvg/   card art + branding (reference)
```
