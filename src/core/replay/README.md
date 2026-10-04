# core/replay

- **Purpose:** reproduce any run exactly: record the seed, a snapshot of the tuning and the player's inputs, then play them back. Agents can replay a bug report; the determinism test relies on it.
- **Format (`replay.ts`):** versioned JSON `{ seed, tuning, ticks, inputs, finalHash }`. Inputs are run-length encoded: an entry is stored only when the actions change, and applies from that tick on. Parsing validates everything (ranges, toggles, tick order) and fails loudly.
- **API:** `startRecording(world)` then `recorder.record(world.tick, world.actions)` before each step and `finish(world)` after the last; `createPlayer(replay).apply(world.actions, world.tick)` before each step; `runReplay(replay)` runs it headless and returns the final world; `restartWorld(world, seed)` rebuilds a world in place.
- **Determinism check (`hash.ts`):** `hashWorld` is a bit-exact hash of the gameplay state (ship, pools, targets, trial, stats; not the camera, which depends on window shape). Same seed + tuning + inputs must give the same hash.
- **Rules that keep it working:** core uses only the seeded RNG and the fixed step; any new gameplay state must be added to `hashWorld`. Replays assume the default pool sizes.
- **Used by:** the dev panel's Replay folder (record, stop, play, verify, export, import).
- **Test:** `replay.test.ts`; `tests/sim/replay.sim.test.ts` (120 s random inputs: determinism, no NaN, bounds, pool caps).

- **Hash audit (`hash-coverage.test.ts`):** the test perturbs every field of every gameplay state object (ship, guns, lock-on, squadron, wingmen, fighters, targets, salvo, trial, stats, `prev`, every pool field, and the RNG state) and fails by name if the hash does not change. A new state field that is not hashed fails there; fields that are deliberately not state are listed with a reason (`EXEMPT`). Format version 4.
