import { timeToImpact } from '../ai/missile-evasion';
import type { World } from '../world/world';

/**
 * Read-only state for the MISSILE warning (spec section 8): what any HUD needs to show that enemy
 * missiles are inbound and where the nearest one is. Computed from the world, never written back,
 * so every style and the spectacle UI can read it. Fill one object and reuse it (no allocation).
 * The classic HUD draws it in `src/render/hud/missile-warning-hud.ts`.
 */
export interface MissileWarning {
  /** True while at least one enemy missile is in flight (all of them home on the player). */
  active: boolean;
  /** Missiles in flight. */
  count: number;
  /** Index of the nearest one in `world.enemies.missiles` (valid this step only), -1 when none. */
  nearest: number;
  /** World position of the nearest missile. */
  x: number;
  y: number;
  /** Heading from the player to the nearest missile (rad, world axes: 0 = +x, counter-clockwise). */
  angle: number;
  /** Distance from the player to the nearest missile (u). */
  distance: number;
  /** Rough seconds until the nearest one reaches the player (distance over closing speed), Infinity when it is not closing. */
  eta: number;
  /** Seconds since the youngest missile launched (a "launch flash" cue), Infinity when none. */
  sinceLaunch: number;
}

export function createMissileWarning(): MissileWarning {
  return {
    active: false,
    count: 0,
    nearest: -1,
    x: 0,
    y: 0,
    angle: 0,
    distance: 0,
    eta: Infinity,
    sinceLaunch: Infinity,
  };
}

/** Fills `out` from the world and returns it. */
export function missileWarning(world: World, out: MissileWarning): MissileWarning {
  const pool = world.enemies.missiles;
  const d = pool.data;
  const { ship } = world;
  out.count = pool.count;
  out.active = pool.count > 0;
  out.nearest = -1;
  out.eta = Infinity;
  out.sinceLaunch = Infinity;
  out.distance = 0;
  out.angle = 0;
  out.x = 0;
  out.y = 0;
  let best = Infinity;
  for (let i = 0; i < pool.count; i++) {
    const dx = d.x[i]! - ship.x;
    const dy = d.y[i]! - ship.y;
    const sq = dx * dx + dy * dy;
    if (sq < best) {
      best = sq;
      out.nearest = i;
    }
    if (d.phase[i]! < out.sinceLaunch) out.sinceLaunch = d.phase[i]!;
  }
  const n = out.nearest;
  if (n >= 0) {
    out.x = d.x[n]!;
    out.y = d.y[n]!;
    out.distance = Math.sqrt(best);
    out.angle = Math.atan2(out.y - ship.y, out.x - ship.x);
    out.eta = timeToImpact(out.x - ship.x, out.y - ship.y, d.vx[n]! - ship.vx, d.vy[n]! - ship.vy);
  }
  return out;
}

/** The warning's text: `MISSILE` (`MISSILES 3` for several) and the nearest one's time, when it is closing. */
export function warningText(w: Pick<MissileWarning, 'count' | 'eta'>): string {
  const head = w.count > 1 ? `MISSILES ${w.count}` : 'MISSILE';
  return Number.isFinite(w.eta) ? `${head}  ${w.eta.toFixed(1)}s` : head;
}
