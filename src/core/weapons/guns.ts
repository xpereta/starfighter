import type { WeaponsConfig } from '../../../data/tuning/weapons';
import type { EventQueue } from '../events/events';
import type { Ship } from '../flight/flight';
import { DEG } from '../math';
import type { Rng } from '../rng/rng';
import type { Collider } from '../world/target';
import { createPool, type Pool } from '../world/pool';
import type { Actions } from '../world/actions';

export type BulletPool = Pool<'x' | 'y' | 'vx' | 'vy' | 'life'>;

export function createBulletPool(cfg: WeaponsConfig): BulletPool {
  return createPool(cfg.bulletCap, ['x', 'y', 'vx', 'vy', 'life']);
}

export interface GunState {
  /** Seconds until the next shot may fire; keeps its remainder so the fire rate does not drift. */
  cooldown: number;
  /** Alternating barrel: -1 left, +1 right. */
  barrel: -1 | 1;
}

export function createGunState(): GunState {
  return { cooldown: 0, barrel: 1 };
}

export function stepGuns(
  state: GunState,
  bullets: BulletPool,
  ship: Ship,
  actions: Actions,
  cfg: WeaponsConfig,
  rng: Rng,
  events: EventQueue,
  dt: number,
): void {
  if (actions.fire) state.cooldown -= dt;
  else state.cooldown = Math.max(0, state.cooldown - dt);
  if (!actions.fire) return;

  const interval = 1 / cfg.fireRate;
  const fx = Math.cos(ship.heading);
  const fy = Math.sin(ship.heading);
  while (state.cooldown <= 0) {
    state.cooldown += interval;
    const i = bullets.spawn();
    if (i < 0) continue; // pool full: the shot is dropped, no event
    const angle = ship.heading + rng.range(-cfg.spread, cfg.spread) * DEG;
    const side = cfg.barrelOffset * state.barrel;
    const x = ship.x + fx * cfg.muzzleOffset - fy * side;
    const y = ship.y + fy * cfg.muzzleOffset + fx * side;
    bullets.data.x[i] = x;
    bullets.data.y[i] = y;
    bullets.data.vx[i] = ship.vx + Math.cos(angle) * cfg.bulletSpeed;
    bullets.data.vy[i] = ship.vy + Math.sin(angle) * cfg.bulletSpeed;
    bullets.data.life[i] = cfg.bulletLife;
    state.barrel = state.barrel === 1 ? -1 : 1;
    events.emit({ type: 'ShotFired', x, y, angle });
  }
}

/** Moves bullets, expires them, and resolves hits against targets. Iterates backwards because removal swaps. */
export function stepBullets(
  bullets: BulletPool,
  targets: readonly Collider[],
  cfg: WeaponsConfig,
  events: EventQueue,
  dt: number,
  /** More things to hit after `targets` (the enemy fighters); optional. */
  extra: readonly Collider[] = NO_COLLIDERS,
): void {
  const { x, y, vx, vy, life } = bullets.data;
  for (let i = bullets.count - 1; i >= 0; i--) {
    x[i]! += vx[i]! * dt;
    y[i]! += vy[i]! * dt;
    life[i]! -= dt;
    if (life[i]! <= 0) {
      bullets.remove(i);
      continue;
    }
    if (hitFirst(bullets, i, targets, cfg, events) || hitFirst(bullets, i, extra, cfg, events)) {
      bullets.remove(i);
    }
  }
}

const NO_COLLIDERS: readonly Collider[] = [];

/** Damages the first living, non-immune collider that bullet `i` overlaps. Returns true on a hit. */
function hitFirst(
  bullets: BulletPool,
  i: number,
  colliders: readonly Collider[],
  cfg: WeaponsConfig,
  events: EventQueue,
): boolean {
  const { x, y, vx, vy } = bullets.data;
  for (const t of colliders) {
    if (!t.alive || t.immune) continue;
    const dx = x[i]! - t.x;
    const dy = y[i]! - t.y;
    const reach = t.radius + cfg.bulletRadius;
    if (dx * dx + dy * dy > reach * reach) continue;
    const speed = Math.hypot(vx[i]!, vy[i]!) || 1;
    t.hp -= cfg.bulletDamage;
    events.emit({
      type: 'Hit',
      x: x[i]!,
      y: y[i]!,
      dirX: vx[i]! / speed,
      dirY: vy[i]! / speed,
      impulse: cfg.hitImpulse,
    });
    return true;
  }
  return false;
}
