import type { MissilesConfig } from '../../../data/tuning/missiles';
import { createPool, type Pool } from '../world/pool';
import type { World } from '../world/world';

/** Missile pool (spec section 2). Issue A2 owns the fields; add what the motion needs. */
export type MissilePool = Pool<'x' | 'y' | 'vx' | 'vy' | 'life' | 'targetId'>;

export function createMissilePool(cfg: MissilesConfig): MissilePool {
  return createPool(cfg.missileCap, ['x', 'y', 'vx', 'vy', 'life', 'targetId']);
}

/** Runs after guns each step (launch, motion, hits). No-op until issue A2. */
export function stepMissiles(world: World): void {
  void world;
}

/** Feeds the missiles into the replay hash. Add every field you add to the pool. */
export function mixMissiles(mix: (n: number) => void, missiles: MissilePool): void {
  mix(missiles.count);
  for (const field of Object.keys(missiles.data) as (keyof typeof missiles.data)[]) {
    const arr = missiles.data[field];
    for (let i = 0; i < missiles.count; i++) mix(arr[i]!);
  }
}
