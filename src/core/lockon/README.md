# core/lockon

- **Purpose:** the player's lock-on: a cone in front of the nose, one target acquired at a time, a lock set that builds up to 1 + living wingmen (spec: `docs/specs/prototype-2-squadron.md` section 1).
- **Status:** contract skeleton. Issue A1 implements acquisition, grace and range loss, events and tests.
- **Contract (do not break without telling the other track):** `world.lockon.locks` is a list of lockable ids (see `core/world/lockable.ts`) in acquisition order, which is the missile priority. `stepLockOn(world)` runs after the squadron and before guns/missiles. Events: `LockAcquiring`, `LockAcquired`, `LockLost`. Anything you add to `LockOn` must also go into `mixLockOn` (replay hash).
- **Parameters:** `data/tuning/lockon.ts`.
