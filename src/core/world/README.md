# core/world

- **Purpose:** the shared world state (plain typed data), the fixed-step entry point `stepWorld`, pools (`createPool`) and the practice arena: drones, turrets, enemy shots, time trial.
- **Owns `World`:** `seed`, `rng`, `events`, `actions`, `tuning`, `ship`, `camera`, `guns`, `bullets`, `enemyShots`, `targets`, `trial`, `stats`, `tick`, `time`.
- **Step order:** clear events, edge-triggered respawn / start-trial, flight, guns, bullets (hits on targets), kills, targets (movement, turrets, respawn), enemy shots (hits on the ship), trial clock, camera.
- **Arena (`arena.ts`):** layout from the seeded RNG (20 static drones, 10 moving drones half straight / half orbiting, 2 turrets). Targets take N hits, then `Killed{kind, x, y, radius}` fires (FX turn it into shards) and the target returns after `respawnDelay`. Straight drones turn back at the arena edge. Turrets fire slow aimed shots at the player in range; the ship ignores them while `ship.invulnerable` (evade i-frames).
- **Time trial (`trial.ts`):** `T` / Start revives every drone and starts the clock; the run ends when all drones are down; `best` is kept across respawns and persisted by the app (`src/app/save.ts`, versioned).
- **Respawn:** `R` / Y resets the ship, shots and arena layout and stops the trial (best time is kept).
- **Prototype 2 slots:** `lockon`, `missiles`, `fighters`, `squadron` and their step functions are in the fixed step order (flight, fighters, squadron, lock-on, guns, missiles, bullets, kills, targets, enemy shots, waves, trial, camera). Each module owns its file and its replay-hash hook; see its README.
- **Events:** clears the queue at the start of each step; systems emit during it.
- **Parameters:** the seed, `data/tuning/arena.ts` (pool caps are read at world creation). Shard counts are visual quality settings in `data/quality.ts`, never gameplay.
- **Test:** `pool.test.ts`, `arena.test.ts`, `trial.test.ts`, `world.test.ts`, and `tests/sim`.
