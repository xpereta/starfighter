import type { World } from '../world/world';
import type { Collider } from '../world/target';

/**
 * Enemy fighter (spec section 3). Issue B1 extends this with the flight state, AI state and so on.
 * Contract: a fighter is a `Collider` (so bullets and missiles can hit it) with a velocity, and its
 * lockable id is `FIGHTER_ID_BASE + index` in `world.fighters`.
 */
export interface Fighter extends Collider {
  vx: number;
  vy: number;
}

/** Runs after the player's flight and before the squadron each step. No-op until issue B1. */
export function stepFighters(world: World): void {
  void world;
}

/** Waves of fighters (spec section 3). No-op until issue B1; runs after enemy shots each step. */
export function stepWaves(world: World): void {
  void world;
}

/** Feeds fighter state into the replay hash. Add every field you add to `Fighter`. */
export function mixFighters(mix: (n: number) => void, fighters: readonly Fighter[]): void {
  mix(fighters.length);
  for (const f of fighters) {
    mix(f.x);
    mix(f.y);
    mix(f.hp);
    mix(f.alive ? 1 : 0);
  }
}
