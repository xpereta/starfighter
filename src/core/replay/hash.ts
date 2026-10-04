import { mixFighters } from '../ai/fighters';
import { mixLockOn } from '../lockon/lockon';
import { mixSquadron } from '../squadron/squadron';
import { mixMissiles } from '../weapons/missiles';
import type { World } from '../world/world';

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/**
 * Hash of the gameplay state (not the camera, which depends on the window's aspect ratio).
 * Two runs with the same seed, tuning and inputs must give the same hash. Bit-exact on purpose.
 */
export function hashWorld(world: World): string {
  const scratch = new DataView(new ArrayBuffer(8));
  let h = FNV_OFFSET;
  const mix = (n: number): void => {
    scratch.setFloat64(0, n);
    for (let i = 0; i < 8; i++) {
      h ^= scratch.getUint8(i);
      h = Math.imul(h, FNV_PRIME);
    }
  };
  const mixPool = (pool: { count: number; data: Readonly<Record<string, Float32Array>> }): void => {
    mix(pool.count);
    for (const field of Object.keys(pool.data)) {
      const arr = pool.data[field]!;
      for (let i = 0; i < pool.count; i++) mix(arr[i]!);
    }
  };

  mix(world.tick);
  mix(world.time);
  mix(world.rng.getState()); // consuming randomness changes the future, so it is state
  const s = world.ship;
  for (const v of [s.x, s.y, s.heading, s.omega, s.speed, s.vx, s.vy]) mix(v);
  for (const v of [s.evadeTimer, s.evadeCooldown, s.evadeSide, s.roll]) mix(v);
  mix(s.invulnerable ? 1 : 0);
  mix(s.evadeHeld ? 1 : 0);
  mix(world.guns.cooldown);
  mix(world.guns.barrel);
  mixPool(world.bullets);
  mixPool(world.enemyShots);
  mixLockOn(mix, world.lockon);
  mixMissiles(mix, world.missiles);
  mixFighters(mix, world.fighters);
  mixSquadron(mix, world.squadron);
  for (const t of world.targets) {
    for (const v of [t.x, t.y, t.hp, t.vx, t.vy, t.angle, t.cooldown, t.respawnTimer]) mix(v);
    mix(t.alive ? 1 : 0);
    // The fixed layout of a target (it is rebuilt on every respawn).
    for (const v of [
      t.radius,
      t.maxHp,
      t.homeX,
      t.homeY,
      t.speed,
      t.orbitX,
      t.orbitY,
      t.orbitRadius,
      t.omega,
    ])
      mix(v);
  }
  const { trial, stats, prev } = world;
  // Last step's buttons: they decide whether a held button counts as a fresh press.
  for (const b of [
    prev.respawn,
    prev.startTrial,
    prev.launch,
    prev.attackOrder,
    prev.cycleFormation,
  ]) {
    mix(b ? 1 : 0);
  }
  mix(trial.active ? 1 : 0);
  mix(trial.time);
  mix(trial.last ?? -1);
  mix(trial.best ?? -1);
  mix(stats.kills);
  mix(stats.hitsTaken);
  return (h >>> 0).toString(16).padStart(8, '0');
}
