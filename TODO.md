# TODO

- [ ] **Branding / favicon.** Real favicon + the "Xor0" wordmark and low-poly mesh
      from the original design art. Card backgrounds currently use a simple generated mesh
      in `Card.tsx` — consider matching the print art more closely.
- [ ] **Animations.** Claim (cards fly to the claimer), table replenish (new cards
      deal in), penalty/paused feedback, winner celebration. Today it's instant.
- [ ] **Card pip legibility.** The mirror-printed dot numbers are a bit cramped at
      small sizes (noted in Phase 0). Tune sizing/spacing.
- [ ] **Multiplayer niceties:** start countdown, handle a player leaving mid-game,
      reconnect/resume, "ready" states in the lobby.

## Tech debt / infra

- [ ] **Realtime latency.** If claims feel laggy for spectators, consider Supabase
      Broadcast (lower latency) in addition to Postgres Changes. Authority stays in
      the RPC, so this is display-only.
