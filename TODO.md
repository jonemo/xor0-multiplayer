# TODO

Status: Phases 0–4 complete and **deployed** at https://play.xor0game.com/.
Solo timed, room-code multiplayer, and quick-match all work and are
verified (including a real two-human multiplayer test). What's left:

## Phase 5 — polish (the main remaining work)

- [ ] **Branding / favicon.** Real favicon + the "Xor0" wordmark and low-poly mesh
      from `design_files/`. Card backgrounds currently use a simple generated mesh
      in `Card.tsx` — consider matching the print art more closely.
- [ ] **Animations.** Claim (cards fly to the claimer), table replenish (new cards
      deal in), penalty/paused feedback, winner celebration. Today it's instant.
- [ ] **Mobile / touch.** Verify the board, scoreboard, and fixed action bar on
      small screens; tune tap targets and the `.xtable` grid breakpoints.
- [ ] **Sound** (optional): a click on select, a chime on a valid XORO, a buzz on
      penalty. Respect a mute toggle.
- [ ] **Card pip legibility.** The mirror-printed dot numbers are a bit cramped at
      small sizes (noted in Phase 0). Tune sizing/spacing.

## Features / UX

- [ ] **Solo leaderboard.** `solo_scores` table + RLS already exist; wire
      `leaderboard.ts` to also write there when authed (see the TODO in that file)
      and add a leaderboard screen. Currently best times are localStorage-only.
- [ ] **Email upgrade UI.** `AuthProvider.linkEmail()` exists but there's no UI to
      let a guest attach an email and keep their stats/name.
- [ ] **Editable display name.** Profiles get a random "Player NNNN" name; let users
      rename (write to `profiles`, which already allows owner updates).
- [ ] **Multiplayer niceties:** rematch button, start countdown, handle a player
      leaving mid-game, reconnect/resume, "ready" states in the lobby.

## Tech debt / infra

- [ ] **CI quality gate.** The deploy workflow only builds. Add a job (or step) that
      runs `npm test` + `npm run typecheck` and blocks deploy on failure.
- [ ] **Realtime latency.** If claims feel laggy for spectators, consider Supabase
      Broadcast (lower latency) in addition to Postgres Changes. Authority stays in
      the RPC, so this is display-only.
- [ ] **Housekeeping for abandoned games.** Anonymous guests + abandoned/finished
      games accumulate in Supabase. Add a periodic purge (pg_cron) of old finished/
      lobby games and stale anonymous users.
- [ ] **Security review** before any real traffic (`/security-review` on the diff).
      Re-check RLS read policies and that no RPC leaks deck order beyond the table.
- [ ] **Bundle size.** ~110 KB gzip, mostly supabase-js. Fine for now; revisit if it
      grows. Solo doesn't need supabase-js — could lazy-load it for online modes.

## Known caveats (context, not necessarily action items)

- The game publishes its own optimal algorithm (`xor0_instructions.md`), so a
  scripted bot can always win public multiplayer — competitive integrity there is
  inherently limited. Fine for a casual/social game.
- `public/CNAME` is redundant with the Pages API cname setting but harmless.
- Workflow actions are current (checkout@v7 / setup-node@v6 / pages@v5); revisit if
  GitHub deprecates them again.

## Quick orientation for a new session

Read `CLAUDE.md`. Key rule: the game engine lives in BOTH `src/lib/xor.ts` and the
SQL migrations (`app.*` + `claim_group`) — keep them in sync. Multiplayer state is
Postgres-authoritative via RPCs; solo is client-side only.
