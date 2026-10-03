import type { World } from '../world/world';

/**
 * Lock-on state (spec section 1). The lock-on issue (A1) fills this in: the acquiring target,
 * its progress, grace timers. Contract: `locks` holds lockable ids (see core/world/lockable.ts)
 * in acquisition order, which is also missile priority.
 */
export interface LockOn {
  locks: number[];
}

export function createLockOn(): LockOn {
  return { locks: [] };
}

/** Runs after squadron AI and before guns/missiles each step. No-op until issue A1. */
export function stepLockOn(world: World): void {
  void world;
}

/** Feeds the lock state into the replay hash. Add every field you add to `LockOn`. */
export function mixLockOn(mix: (n: number) => void, lockon: LockOn): void {
  mix(lockon.locks.length);
  for (const id of lockon.locks) mix(id);
}
