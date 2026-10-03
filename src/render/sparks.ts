import * as THREE from 'three';
import type { GameEvent } from '../core/events/events';
import { createPool } from '../core/world/pool';
import { palette } from './palette';

const CAPACITY = 256;
const PER_HIT = 7;
const SPEED_MIN = 120;
const SPEED_MAX = 420;
const LIFE = 0.28;
const STREAK = 0.035; // seconds of travel drawn as the spark's length

export interface Sparks {
  readonly object: THREE.LineSegments;
  /** Spawns sparks for `Hit` events. Call once per simulation step with that step's events. */
  consume(events: readonly GameEvent[]): void;
  /** Advances and draws the sparks; `dt` is wall-clock seconds. */
  update(dt: number): void;
  dispose(): void;
}

/** Hit sparks: a visual-only consumer of `Hit` events, in a fixed-size pool (no gameplay code involved). */
export function createSparks(): Sparks {
  const pool = createPool(CAPACITY, ['x', 'y', 'vx', 'vy', 'life']);
  const positions = new Float32Array(CAPACITY * 2 * 3);
  const geometry = new THREE.BufferGeometry();
  const attr = new THREE.BufferAttribute(positions, 3);
  attr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', attr);
  geometry.setDrawRange(0, 0);
  const material = new THREE.LineBasicMaterial({ color: palette.projectile });
  const lines = new THREE.LineSegments(geometry, material);
  lines.frustumCulled = false;
  lines.position.z = 0.6;

  return {
    object: lines,
    consume(events) {
      for (const e of events) {
        if (e.type !== 'Hit') continue;
        const base = Math.atan2(-e.dirY, -e.dirX); // sparks fly back out of the target
        for (let k = 0; k < PER_HIT; k++) {
          const i = pool.spawn();
          if (i < 0) return;
          const angle = base + (Math.random() - 0.5) * 2.2;
          const speed = SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN);
          pool.data.x[i] = e.x;
          pool.data.y[i] = e.y;
          pool.data.vx[i] = Math.cos(angle) * speed;
          pool.data.vy[i] = Math.sin(angle) * speed;
          pool.data.life[i] = LIFE * (0.6 + Math.random() * 0.4);
        }
      }
    },
    update(dt) {
      const { x, y, vx, vy, life } = pool.data;
      for (let i = pool.count - 1; i >= 0; i--) {
        life[i]! -= dt;
        if (life[i]! <= 0) {
          pool.remove(i);
          continue;
        }
        x[i]! += vx[i]! * dt;
        y[i]! += vy[i]! * dt;
      }
      for (let i = 0; i < pool.count; i++) {
        const o = i * 6;
        positions[o] = x[i]!;
        positions[o + 1] = y[i]!;
        positions[o + 3] = x[i]! - vx[i]! * STREAK;
        positions[o + 4] = y[i]! - vy[i]! * STREAK;
      }
      geometry.setDrawRange(0, pool.count * 2);
      attr.needsUpdate = true;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
