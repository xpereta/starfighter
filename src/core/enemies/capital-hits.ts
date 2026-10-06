import type { World } from '../world/world';
import { CAPITAL_PARTS, damagePart, distanceToPart, isCovered } from './capital';
import type { CapitalPartDef } from './capital-parts';
import type { CapitalState } from './state';

/**
 * Which part a point touches (bullets, spec section 5): among the living parts that can be hit
 * (not covered by a standing plate) the one whose surface the point is closest to, that is the
 * shallowest overlap, so a bullet entering the hull meets the outermost part first. Ties go to the
 * lower index. `reach` widens every part by the bullet radius. Returns the part index or -1.
 * Cheap on purpose: one hull-circle test first (the broad phase), then at most one test per part.
 */
export function partAt(
  cap: CapitalState,
  x: number,
  y: number,
  reach: number,
  defs: readonly CapitalPartDef[] = CAPITAL_PARTS,
): number {
  if (cap.phase !== 0) return -1;
  const dx = x - cap.x;
  const dy = y - cap.y;
  const hull = cap.hullRadius + reach;
  if (dx * dx + dy * dy > hull * hull) return -1; // broad phase
  let best = -1;
  let bestDepth = -Infinity;
  for (let i = 0; i < defs.length; i++) {
    if (!cap.parts[i]!.alive) continue;
    const gap = distanceToPart(cap, defs[i]!, x, y) - reach; // <= 0 means touching
    if (gap > 0 || gap <= bestDepth) continue;
    if (isCovered(cap, i, defs)) continue;
    bestDepth = gap;
    best = i;
  }
  return best;
}

/**
 * Resolves the bullets in the pool against the capital ship, after they moved: each bullet that
 * touches a part damages it (through `damagePart`) and is spent, with a `Hit` event for sparks.
 * Plates shield what they cover. Runs after `stepBullets` so a bullet that already hit something
 * else is gone. Does nothing without a ship.
 */
export function stepCapitalBullets(world: World): void {
  const cap = world.enemies.capital;
  if (!cap || cap.phase !== 0) return;
  const bullets = world.bullets;
  const { x, y, vx, vy, damage, owner } = bullets.data;
  const reach = world.tuning.weapons.bulletRadius;
  for (let i = bullets.count - 1; i >= 0; i--) {
    const part = partAt(cap, x[i]!, y[i]!, reach);
    if (part < 0) continue;
    damagePart(world, part, damage[i]!, owner[i]!);
    const speed = Math.hypot(vx[i]!, vy[i]!) || 1;
    world.events.emit({
      type: 'Hit',
      x: x[i]!,
      y: y[i]!,
      dirX: vx[i]! / speed,
      dirY: vy[i]! / speed,
      impulse: world.tuning.weapons.hitImpulse,
    });
    bullets.remove(i);
  }
}
