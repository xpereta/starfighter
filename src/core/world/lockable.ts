import type { World } from './world';
import type { Collider } from './target';

/**
 * One id space for everything the player can lock and missiles can hit:
 * ids below FIGHTER_ID_BASE are indexes into `world.targets`, ids from FIGHTER_ID_BASE up are
 * indexes into `world.fighters` (id - FIGHTER_ID_BASE). Wingmen are friends and never lockable.
 */
export const FIGHTER_ID_BASE = 1000;

export interface LockableVisit {
  (id: number, x: number, y: number, vx: number, vy: number, radius: number): void;
}

/** Visits every living lockable enemy. Allocation-free. */
export function forEachLockable(world: World, visit: LockableVisit): void {
  world.targets.forEach((t, i) => {
    if (t.alive) visit(i, t.x, t.y, t.vx, t.vy, t.radius);
  });
  world.fighters.forEach((f, i) => {
    if (f.alive) visit(FIGHTER_ID_BASE + i, f.x, f.y, f.vx, f.vy, f.radius);
  });
}

/** The hittable body behind a lockable id (mutable `hp`), or undefined if the id is stale. */
export function getLockable(world: World, id: number): Collider | undefined {
  return id >= FIGHTER_ID_BASE ? world.fighters[id - FIGHTER_ID_BASE] : world.targets[id];
}
