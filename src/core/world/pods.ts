import type { World } from './world';

/**
 * A rescue pod (spec section 3). Issue B1 implements spawning, drift, rescue progress, enemy
 * targeting and destruction; this contract fixes the shape. A rescued pod's pilot joins at once.
 */
export interface Pod {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  alive: boolean;
  /** 0..1 rescue progress: fills while the player is close, drains while away. */
  progress: number;
  /** The id the pilot inside will get when rescued, fixed when the pod spawns so a replay is reproducible. */
  pilotId: number;
}

/** Runs after enemy shots each step. No-op until issue B1. */
export function stepPods(world: World): void {
  void world;
}

/** Feeds the pods into the replay hash. Add every field you add to `Pod`. */
export function mixPods(mix: (n: number) => void, pods: readonly Pod[]): void {
  mix(pods.length);
  for (const p of pods) {
    for (const v of [p.x, p.y, p.vx, p.vy, p.hp, p.progress, p.pilotId]) mix(v);
    mix(p.alive ? 1 : 0);
  }
}
