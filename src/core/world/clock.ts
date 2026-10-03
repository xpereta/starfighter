import type { World } from './world';

/**
 * Length of one simulation step in seconds. `stepWorld` runs fixed steps and the subsystem hooks
 * (`stepFighters(world)` and friends) are not handed `dt`, so it is recovered from the clock:
 * `time` is advanced by `dt` once per `tick`. Only call it from inside a step (tick >= 1).
 */
export function stepSeconds(world: World): number {
  return world.tick > 0 ? world.time / world.tick : 0;
}
