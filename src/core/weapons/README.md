# core/weapons

- **Purpose:** the player's guns: two alternating barrels, pooled bullets, hit resolution against targets.
- **Reads:** `world.actions.fire`, `world.ship`, `world.tuning.weapons`, `world.rng` (spread), `world.targets`. **Writes:** `world.guns`, `world.bullets` (pool, cap `bulletCap`), `target.hp` on hit.
- **Events out:** `ShotFired{x, y, angle}` (only when a bullet is actually spawned), `Hit{x, y, dirX, dirY, impulse}`. Sparks and shake attach to these; this module knows nothing about FX. Killing a target (`Killed`, shards) belongs to the targets issue.
- **Behavior:** bullet velocity = ship velocity + `bulletSpeed` along the nose (+ seeded spread). Fire rate keeps its remainder, so it does not drift. A full pool drops the shot.
- **Parameters:** `data/tuning/weapons.ts`.
- **Test:** `guns.test.ts`; pool cap and no-NaN under 120 s of random fire in `tests/sim/weapons.sim.test.ts`.

## Missiles (Prototype 2)

- **Status:** contract skeleton in `missiles.ts` (pool, `stepMissiles` slot, `mixMissiles` hash hook). Issue A2 implements the salvo, motion (acceleration, homing, wobble) and hits (spec section 2). Wingman launches come with integration issue I1. Missiles damage through `getLockable` (`core/world/lockable.ts`) so they work on targets and fighters alike.
- **Parameters:** `data/tuning/missiles.ts` (`missileCap` is read at world creation).
