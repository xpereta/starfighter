# core/weapons

- **Purpose:** the player's guns: two alternating barrels, pooled bullets, hit resolution against targets.
- **Reads:** `world.actions.fire`, `world.ship`, `world.tuning.weapons`, `world.rng` (spread), `world.targets`. **Writes:** `world.guns`, `world.bullets` (pool, cap `bulletCap`), `target.hp` on hit.
- **Events out:** `ShotFired{x, y, angle}` (only when a bullet is actually spawned), `Hit{x, y, dirX, dirY, impulse}`. Sparks and shake attach to these; this module knows nothing about FX. Killing a target (`Killed`, shards) belongs to the targets issue. `stepBullets` also takes an `extra` list of colliders (the enemy fighters); colliders with `immune` set (a fighter in its evade i-frames) are skipped.
- **Behavior:** bullet velocity = ship velocity + `bulletSpeed` along the nose (+ seeded spread). Fire rate keeps its remainder, so it does not drift. A full pool drops the shot.
- **Parameters:** `data/tuning/weapons.ts`.
- **Test:** `guns.test.ts`; pool cap and no-NaN under 120 s of random fire in `tests/sim/weapons.sim.test.ts`.

## Missiles (Prototype 2)

- **Purpose:** the salvo and its missiles (spec section 2): the launch button fires one missile per pilot at the locked targets, rippling out, each accelerating, homing and weaving.
- **Reads:** `world.actions.launch` + `world.prev.launch` (edge-triggered), `world.lockon.locks` (targets, in priority order), `world.ship`, `livingWingmen`, `world.tuning.missiles`, `world.rng` (wobble phase). **Writes:** `world.missiles` (pool, cap `missileCap`, plus the `salvo` state on it), `hp` of whatever it hits (through `getLockable`, so targets and fighters alike).
- **Launch:** needs at least one lock, the cooldown (`salvoCooldown`, counted from the launch) at 0, and a fresh press (holding does nothing). Missiles are assigned round-robin in lock order (`assignSalvo`): more pilots than locks double up from the top, fewer pilots use only the first locks. They leave `salvoStagger` apart. A missile that does not fit in the pool is dropped without an event. The locks themselves are not consumed by a launch.
- **Launching spends the locks:** the salvo keeps the targets it was assigned, but `world.lockon.locks` (and its grace timers) empty, so the next salvo needs fresh locks (Xavi's call, 2026-10-04). A target being acquired keeps filling.
- **Launchers:** every pilot fires from their own ship. A salvo is `salvoPilots` = the player first, then each living wingman in squadron order; the salvo remembers who fires each pending missile (`salvo.pilots`, `PLAYER` or the wingman's index). `launchOrigin(world, pilot)` gives that ship's nose position, velocity and heading. A wingman shot down before their turn in the ripple does not fire (no missile, no event).
- **Motion:** starts at `launchSpeed` plus the launcher's speed along its heading (never less than `launchSpeed`), accelerates at `missileAccel` to `missileMaxSpeed`; steers toward a living target at most `missileTurnRate`; a seeded sinusoidal wobble (`wobbleAmount`, `wobbleHz`) is added to the flight direction (not to the steered heading). If the target dies it flies straight (`targetId = -1`); it burns out after `missileLife`.
- **Hits:** the closest living enemy within `missileRadius` of a missile takes `missileDamage`, whether or not it is the intended target; `Hit{..., impulse: missileHitImpulse}` is emitted and the missile is consumed. Killing (`Killed`, shards, kill count) is the normal flow in `stepWorld` for targets, and the fighters' own step for fighters.
- **Immune targets:** a missile passes through an `immune` body (a fighter in its evade i-frames, see `core/ai`); if that was the target it homed on, it loses its lock (`targetId = -1`) and flies straight until it burns out or hits something else.
- **Events:** `SalvoFired{count}` (the number of missiles assigned), `MissileLaunched{x, y, angle, targetId}`.
- **Identity:** every missile has a `uid` (from `salvo.nextUid`), because pool slots move when a missile is removed; the renderer keys its trails on it.
- **Hash:** `mixMissiles` covers every pool field (including `uid`) and the salvo state (cooldown, pending list, timer, launched, next uid).
- **Parameters:** `data/tuning/missiles.ts` (`missileCap` is read at world creation), in the panel's Missiles section.
- **Test:** `missiles.test.ts` (assignment, launch rules, edge trigger, cooldown, stagger, pool cap, speed curve, expiry, wobble bound and determinism, homing turn limit, target death, hits on targets/fighters/blockers, kills through the world step, hash sensitivity, reset); `tests/sim/missiles.sim.test.ts` (120 s of bot play: no NaN, pool within cap, hits happen, deterministic).
