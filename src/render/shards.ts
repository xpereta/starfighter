import * as THREE from 'three';
import type { GameEvent } from '../core/events/events';
import { createPool } from '../core/world/pool';
import type { EntityKind } from '../core/world/target';
import type { QualitySettings } from '../../data/quality';
import { palette } from './palette';

const SPEED_MIN = 40;
const SPEED_MAX = 140;
const SPIN_MAX = 6; // rad/s
const SHARD_SIZE = 0.45; // fraction of the dead target's radius

const KIND_COLOR: Record<EntityKind, number> = {
  fighter: palette.fighter,
  wingman: palette.wingman,
  static: palette.enemyStatic,
  drone: palette.enemy,
  turret: palette.turret,
};

/** How many shards a kill produces: `roll` is a uniform [0, 1) number. Pure, so it is testable. */
export function shardCount(
  quality: Pick<QualitySettings, 'shardsMin' | 'shardsMax'>,
  roll: number,
): number {
  const lo = Math.min(quality.shardsMin, quality.shardsMax);
  const hi = Math.max(quality.shardsMin, quality.shardsMax);
  return lo + Math.floor(roll * (hi - lo + 1));
}

export interface Shards {
  readonly object: THREE.InstancedMesh;
  /** Spawns shards for `Killed` events (the death-sequence hook). Call once per simulation step. */
  consume(events: readonly GameEvent[]): void;
  /** Advances and draws the shards; `dt` is wall-clock seconds. */
  update(dt: number): void;
  dispose(): void;
}

/** Flat triangular shards that drift, spin and fade. Visual only: quality presets control counts and life. */
export function createShards(quality: QualitySettings): Shards {
  const pool = createPool(quality.shardCap, [
    'x',
    'y',
    'vx',
    'vy',
    'rot',
    'spin',
    'life',
    'size',
    'color',
  ]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array([0, 1, 0, -0.8, -0.6, 0, 0.8, -0.6, 0]), 3),
  );
  const material = new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide });
  const mesh = new THREE.InstancedMesh(geometry, material, quality.shardCap);
  mesh.frustumCulled = false;
  mesh.count = 0;
  mesh.position.z = 0.3;
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  return {
    object: mesh,
    consume(events) {
      for (const e of events) {
        if (e.type !== 'Killed') continue;
        const n = shardCount(quality, Math.random());
        for (let k = 0; k < n; k++) {
          const i = pool.spawn();
          if (i < 0) return;
          const angle = Math.random() * Math.PI * 2;
          const speed = SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN);
          pool.data.x[i] = e.x;
          pool.data.y[i] = e.y;
          pool.data.vx[i] = Math.cos(angle) * speed;
          pool.data.vy[i] = Math.sin(angle) * speed;
          pool.data.rot[i] = Math.random() * Math.PI * 2;
          pool.data.spin[i] = (Math.random() * 2 - 1) * SPIN_MAX;
          pool.data.life[i] = quality.shardLife * (0.7 + Math.random() * 0.3);
          pool.data.size[i] = e.radius * SHARD_SIZE;
          pool.data.color[i] = KIND_COLOR[e.kind];
        }
      }
    },
    update(dt) {
      const d = pool.data;
      for (let i = pool.count - 1; i >= 0; i--) {
        d.life[i]! -= dt;
        if (d.life[i]! <= 0) {
          pool.remove(i);
          continue;
        }
        d.x[i]! += d.vx[i]! * dt;
        d.y[i]! += d.vy[i]! * dt;
        d.rot[i]! += d.spin[i]! * dt;
      }
      mesh.count = pool.count;
      for (let i = 0; i < pool.count; i++) {
        const fade = Math.min(1, d.life[i]! / (quality.shardLife * 0.4));
        dummy.position.set(d.x[i]!, d.y[i]!, 0);
        dummy.rotation.z = d.rot[i]!;
        dummy.scale.setScalar(d.size[i]! * (0.4 + 0.6 * fade));
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, color.setHex(d.color[i]!).multiplyScalar(fade));
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
