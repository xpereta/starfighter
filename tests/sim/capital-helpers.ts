import { CAPITAL_PARTS } from '../../data/content/capital';
import { partCenter } from '../../src/core/enemies/capital';
import type { World } from '../../src/core/world/world';

export const defs = CAPITAL_PARTS;

/** Throws on anything a capital ship fight must never produce: NaN, healed parts, pools over their caps, a part outside the arena. */
export function checkCapital(world: World): void {
  const cap = world.enemies.capital!;
  const finite = [cap.x, cap.y, cap.heading, cap.vx, cap.vy, cap.time, cap.chainTime];
  for (const v of finite) if (!Number.isFinite(v)) throw new Error('NaN in the capital ship');
  for (const p of cap.parts) {
    if (!Number.isFinite(p.hp + p.cooldown)) throw new Error('NaN in a part');
    if (p.hp > p.maxHp) throw new Error('part healed');
    if (p.alive !== p.hp > 0) throw new Error('alive and hp disagree');
  }
  const { ship } = world;
  if (!Number.isFinite(ship.x + ship.y + ship.speed + ship.heading)) throw new Error('NaN ship');
  if (world.bullets.count > world.bullets.capacity) throw new Error('bullet pool over cap');
  if (world.missiles.count > world.missiles.capacity) throw new Error('missile pool over cap');
  if (world.enemyShots.count > world.enemyShots.capacity) throw new Error('shot pool over cap');
  // Every part stays inside the arena.
  const c = { x: 0, y: 0 };
  const arena = world.tuning.flight.arenaRadius;
  defs.forEach((d, i) => {
    if (!cap.parts[i]!.alive) return;
    partCenter(c, cap, d);
    if (Math.hypot(c.x, c.y) > arena) throw new Error(`part ${d.id} left the arena`);
  });
}
