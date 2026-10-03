# core/lockon

- **Purpose:** the player's lock-on: a cone in front of the nose, one target acquired at a time, a lock set that builds up to 1 + living wingmen (spec: `docs/specs/prototype-2-squadron.md` section 1).
- **Reads:** `world.ship` (position, heading), lockable bodies through `forEachLockable` / `getLockable` (`core/world/lockable.ts`: targets and fighters), `livingWingmen(world.squadron)`, `world.tuning.lockon`. **Writes:** `world.lockon`.
- **Contract (do not break without telling the other track):** `world.lockon.locks` is a list of lockable ids in acquisition order, which is the missile priority. `stepLockOn(world)` runs after the squadron and before guns/missiles. `lockLimit(world)` is `min(lockCap, 1 + livingWingmen)`. Anything you add to `LockOn` must also go into `mixLockOn` (replay hash).
- **State (`LockOn`):** `locks`, `graces` (parallel to `locks`: seconds outside the cone), `acquiringId` (-1 = none), `progress` (seconds in the cone, 0..`lockTime`), `acquiringGrace`.
- **Behavior:**
  - A candidate is a living lockable within `lockRange` (counting its radius) and inside the cone. The angle is measured to the edge of the body, so big targets are easier to hold.
  - With nothing being acquired and room in the set, the candidate nearest the nose axis starts acquiring (ties: lower id). One target at a time. It keeps being acquired while it stays valid; it is not swapped for a closer one mid-fill.
  - Progress fills only while the target is inside the cone; outside the cone it pauses, and after `lockGrace` the progress is lost. At `lockTime` it joins the lock set and the next candidate starts filling.
  - A held lock is dropped when its target is dead or gone (`dead`), beyond range (`range`), or outside the cone longer than the grace (`cone`). The grace timer resets whenever the target is back inside.
  - When a wingman dies the limit drops but existing locks are kept (they stay in priority order); only acquisition pauses. The salvo uses as many as there are pilots.
- **Events:** `LockAcquiring{targetId}`, `LockAcquired{targetId}`, `LockLost{targetId, reason}` (also for an acquiring target that is lost).
- **Parameters:** `data/tuning/lockon.ts` (cone half-angle, range, lock time, grace, cap), in the panel's Lock-on section.
- **Test:** `lockon.test.ts` (cone geometry, acquisition order, limit with 0-4 wingmen, grace/range/death loss, determinism, hash sensitivity); `tests/sim/lockon.sim.test.ts` (120 s random flight: locks always refer to living lockables).
