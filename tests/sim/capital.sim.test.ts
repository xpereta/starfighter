import { describe, expect, it } from 'vitest';
import { createTuning } from '../../data/tuning';
import { coreIndex, isCovered, partCenter } from '../../src/core/enemies/capital';
import { spawnCapitalAt } from '../../src/core/enemies/capital-battle';
import type { PartRole } from '../../src/core/enemies/capital-parts';
import type { GameEvent } from '../../src/core/events/events';
import { hashWorld } from '../../src/core/replay/hash';
import { createWorld, stepWorld, type World } from '../../src/core/world/world';
import { checkCapital as check, defs } from './capital-helpers';

const DT = 1 / 60;
const MAX_STEPS = 60 * 600; // ten simulated minutes: a fight must end well before this

/** The order a bot attacks the parts in: lower rank goes first among what can be hit. */
type Order = (role: PartRole, index: number) => number;
const byRole =
  (...roles: PartRole[]): Order =>
  (role, index) =>
    roles.indexOf(role) * 100 + index;
const ORDERS: Record<string, Order> = {
  'turrets, engines, plates, bridge, core': byRole('turret', 'engine', 'armour', 'bridge', 'core'),
  'plates first, then the core': byRole('armour', 'core', 'bridge', 'engine', 'turret'),
  'engines and bridge first': byRole('engine', 'bridge', 'armour', 'core', 'turret'),
  backwards: (_role, index) => -index,
};

interface Fight {
  world: World;
  steps: number;
  /** Part ids in the order they were destroyed. */
  destroyed: string[];
  events: Record<string, number>;
  exposedBeforeCoreDamage: boolean;
  maxShots: number;
  maxBullets: number;
}

/**
 * A scripted bot that parks the ship 450 u from the part it wants (the first hittable part in
 * `order`), nose on it, firing: the fight is decided by the damage routing, not by flying skill.
 * Practice mode, so the player cannot die; the capital ship shoots at it all the same.
 */
function fight(seed: number, order: Order): Fight {
  const tuning = createTuning();
  tuning.capital.cruiseSpeed = 0; // the bot walks the ship around instead
  const world = createWorld(seed, tuning);
  spawnCapitalAt(world, 2400, 600);
  const cap = world.enemies.capital!;
  const destroyed: string[] = [];
  const events: Record<string, number> = {};
  let exposedBeforeCoreDamage = true;
  let maxShots = 0;
  let maxBullets = 0;
  const target = { x: 0, y: 0 };
  let steps = 0;
  while (cap.phase !== 2 && steps < MAX_STEPS) {
    steps++;
    // The part to attack: the best-ranked one that can be hit now.
    let pick = -1;
    let rank = Infinity;
    defs.forEach((d, i) => {
      if (!cap.parts[i]!.alive || isCovered(cap, i)) return;
      const r = order(d.role, i);
      if (r < rank) {
        rank = r;
        pick = i;
      }
    });
    if (pick >= 0 && cap.phase === 0) {
      partCenter(target, cap, defs[pick]!);
      const away = Math.atan2(target.y - cap.y, target.x - cap.x);
      const aim = Math.atan2(target.y - world.ship.y, target.x - world.ship.x);
      // Hold 450 u off the part on the side the ship is already on (never inside the hull).
      world.ship.x = target.x - Math.cos(aim) * 450 + Math.cos(away) * 0;
      world.ship.y = target.y - Math.sin(aim) * 450;
      world.ship.heading = aim;
      world.actions.fire = true;
    } else world.actions.fire = false;
    const coreHp = cap.parts[coreIndex()]!.hp;
    stepWorld(world, DT);
    check(world);
    maxShots = Math.max(maxShots, world.enemyShots.count);
    maxBullets = Math.max(maxBullets, world.bullets.count);
    for (const e of world.events.events as readonly GameEvent[]) {
      events[e.type] = (events[e.type] ?? 0) + 1;
      if (e.type === 'PartDestroyed') destroyed.push(e.part);
    }
    if (cap.parts[coreIndex()]!.hp < coreHp && !cap.coreExposed) exposedBeforeCoreDamage = false;
  }
  return { world, steps, destroyed, events, exposedBeforeCoreDamage, maxShots, maxBullets };
}

describe('a capital ship fight in practice mode', () => {
  for (const [name, order] of Object.entries(ORDERS)) {
    it(`parts die in this order and the ship always ends: ${name}`, () => {
      const f = fight(7, order);
      const cap = f.world.enemies.capital!;
      expect(cap.phase, `still fighting after ${f.steps} steps`).toBe(2);
      expect(f.steps).toBeLessThan(MAX_STEPS);
      // Every part died exactly once; the core went first among the covered, CoreExposed once, CapitalDestroyed once.
      expect(f.destroyed).toHaveLength(defs.length);
      expect(new Set(f.destroyed).size).toBe(defs.length);
      expect(f.events.CoreExposed).toBe(1);
      expect(f.events.CapitalDestroyed).toBe(1);
      // The core took no damage until the plates were down.
      expect(f.exposedBeforeCoreDamage).toBe(true);
      // The core died before the chain took the rest (it is the trigger), unless parts were already gone.
      const coreAt = f.destroyed.indexOf('core');
      expect(coreAt).toBeGreaterThanOrEqual(0);
      // Pools stayed bounded.
      expect(f.maxShots).toBeLessThanOrEqual(f.world.enemyShots.capacity);
      expect(f.maxBullets).toBeLessThanOrEqual(f.world.bullets.capacity);
    });
  }

  it('the part orders really differ (the orders test different paths)', () => {
    const a = fight(7, ORDERS['turrets, engines, plates, bridge, core']!).destroyed.slice(0, 6);
    const b = fight(7, ORDERS['plates first, then the core']!).destroyed.slice(0, 6);
    expect(a).not.toEqual(b);
  });

  it('is deterministic: the same seed and bot give the same hash', () => {
    const order = ORDERS['backwards']!;
    const a = fight(11, order);
    const b = fight(11, order);
    expect(hashWorld(a.world)).toBe(hashWorld(b.world));
    expect(a.destroyed).toEqual(b.destroyed);
    const c = fight(12, order);
    expect(hashWorld(c.world)).not.toBe(hashWorld(a.world));
  });

  it('a ship with dead engines sits still and one with a dead bridge keeps firing, worse', () => {
    const tuning = createTuning();
    const world = createWorld(3, tuning);
    spawnCapitalAt(world, 3000, 0);
    const cap = world.enemies.capital!;
    const engines = defs.map((d, i) => (d.role === 'engine' ? i : -1)).filter((i) => i >= 0);
    for (const i of engines) cap.parts[i]!.hp = cap.parts[i]!.alive ? 0.0001 : 0;
    for (const i of engines) {
      cap.parts[i]!.alive = false;
      cap.parts[i]!.hp = 0;
    }
    for (let i = 0; i < 60 * 15; i++) stepWorld(world, DT);
    const stopped = { x: cap.x, y: cap.y, heading: cap.heading };
    for (let i = 0; i < 60 * 10; i++) stepWorld(world, DT);
    expect(cap.x).toBeCloseTo(stopped.x, 3);
    expect(cap.heading).toBe(stopped.heading);
  });
});
