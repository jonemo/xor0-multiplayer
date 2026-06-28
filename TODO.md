# TODO

Status: Phases 0–4 complete and **deployed** at https://play.xor0game.com/.
Solo timed, room-code multiplayer, and quick-match all work and are
verified (including a real two-human multiplayer test). What's left:

## Phase 5 — polish (the main remaining work)

- [ ] **Branding / favicon.** Real favicon + the "Xor0" wordmark and low-poly mesh
      from the original design art. Card backgrounds currently use a simple generated mesh
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

- [x] **Solo leaderboard.** `get_solo_leaderboard` RPC (`0008`) + `fetchLeaderboard`
      back a `Leaderboard` screen; `useSoloGame` writes finished runs to `solo_scores`
      when signed in (guests included). Personal best still in localStorage.
- [x] **Email upgrade UI.** `AccountDialog` lets a guest attach an email
      (`AuthProvider.upgradeWithEmail`) and keep their name/stats, or sign in to an
      existing account (`signInWithEmail`). Passwordless magic link.
- [x] **Editable display name.** Registered users can rename via `AccountDialog`
      (`AuthProvider.updateDisplayName` → `profiles`). Guests keep "Player NNNN".
- [ ] **Multiplayer niceties:** start countdown, handle a player leaving mid-game,
      reconnect/resume, "ready" states in the lobby.

## Tech debt / infra

- [x] **CI quality gate.** The deploy workflow only builds. Add a job (or step) that
      runs `npm test` + `npm run typecheck` and blocks deploy on failure.
- [ ] **Realtime latency.** If claims feel laggy for spectators, consider Supabase
      Broadcast (lower latency) in addition to Postgres Changes. Authority stays in
      the RPC, so this is display-only.
- [ ] **Housekeeping for abandoned games.** Anonymous guests + abandoned/finished
      games accumulate in Supabase. Add a periodic purge (pg_cron) of old finished/
      lobby games and stale anonymous users.
- [x] **Security review** before any real traffic (`/security-review` on the diff).
      Re-check RLS read policies and that no RPC leaks deck order beyond the table.
- [ ] **Bundle size.** ~110 KB gzip, mostly supabase-js. Fine for now; revisit if it
      grows. Solo doesn't need supabase-js — could lazy-load it for online modes.

## Quick orientation for a new session

Read `CLAUDE.md`. Key rule: the game engine lives in BOTH `src/lib/xor.ts` and the
SQL migrations (`app.*` + `claim_group`) — keep them in sync. Multiplayer state is
Postgres-authoritative via RPCs; solo is client-side only.
