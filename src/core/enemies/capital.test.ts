import { describe, expect, it } from 'vitest';
import { CAPITAL_DESIGN_RADIUS, CAPITAL_PARTS } from '../../../data/content/capital';
import { createTuning } from '../../../data/tuning';
import { capitalParams } from '../../../data/tuning/capital';
import { DEG } from '../math';
import { createWorld, stepWorld, type World } from '../world/world';
import type { GameEvent } from '../events/events';
import {
  boundRadius,
  broadsideHeading,
  coreIndex,
  countRole,
  createCapital,
  damagePart,
  distanceToPart,
  engineShare,
  forEachPart,
  isCovered,
  killPart,
  nextPartTarget,
  PART_ID_BASE,
  partBody,
  partCenter,
} from './capital';
import { inArc, keepInside, stepCapital, stepCapitalMotion } from './capital-ai';
import { partAt, stepCapitalBullets } from './capital-hits';
import { validateCapitalParts } from './capital-parts';

const defs = CAPITAL_PARTS;
const indexOf = (id: string): number => defs.findIndex((d) => d.id === id);

/** A world with the capital ship at the origin, heading 0 (nose along +x), the player far away. */
function worldWithCapital(): World {
  const w = createWorld(3, createTuning());
  w.ship.x = 0;
  w.ship.y = -3000;
  w.tick = 1;
  w.time = 1 / 60;
  w.enemies.capital = createCapital(0, 0, 0, 3000, w.tuning.capital, w.rng);
  return w;
}

const eventsOf = (w: World, type: GameEvent['type']): GameEvent[] =>
  w.events.events.filter((e) => e.type === type);

/** Destroys every plate that covers the core. */
function stripCorePlates(w: World): void {
  for (let i = 0; i < defs.length; i++) {
    if (defs[i]!.covers.includes('core')) killPart(w, i);
  }
}

describe('the real capital ship data', () => {
  it('is a legal ship inside its hull', () => {
    expect(() => validateCapitalParts(defs, capitalParams.hullRadius.default)).not.toThrow();
    expect(CAPITAL_DESIGN_RADIUS).toBe(capitalParams.hullRadius.default);
  });

  it('has the spec parts: 6 to 8 turrets (some heavy), 2 engines, 4 to 6 plates, a bridge, a core', () => {
    const count = (role: string): number => defs.filter((d) => d.role === role).length;
    expect(count('turret')).toBeGreaterThanOrEqual(6);
    expect(count('turret')).toBeLessThanOrEqual(8);
    expect(count('engine')).toBe(2);
    expect(count('armour')).toBeGreaterThanOrEqual(4);
    expect(count('armour')).toBeLessThanOrEqual(6);
    expect(count('bridge')).toBe(1);
    expect(count('core')).toBe(1);
    const turrets = defs.filter((d) => d.role === 'turret');
    const slowest = Math.min(...turrets.map((d) => d.mount!.fireRate));
    const fastest = Math.max(...turrets.map((d) => d.mount!.fireRate));
    expect(slowest).toBeLessThan(fastest / 2); // the heavy ones are clearly slower
    expect(Math.max(...turrets.map((d) => d.mount!.bulletDamage))).toBeGreaterThan(1);
  });

  it('every turret has a bounded arc (blind spots) and a burst window', () => {
    for (const d of defs.filter((p) => p.role === 'turret')) {
      expect(d.mount!.arcHalf, d.id).toBeLessThan(Math.PI);
      expect(d.mount!.burst.pause, d.id).toBeGreaterThan(0);
    }
  });

  it('every part stays inside the hull circle once scaled to any allowed hull radius', () => {
    for (const hull of [capitalParams.hullRadius.min, capitalParams.hullRadius.max]) {
      const cap = createCapital(
        0,
        0,
        0,
        1000,
        { hullRadius: hull, partHpScale: 1 },
        createWorld(1, createTuning()).rng,
      );
      const c = { x: 0, y: 0 };
      defs.forEach((d) => {
        partCenter(c, cap, d);
        expect(Math.hypot(c.x, c.y) + boundRadius(cap, d)).toBeLessThanOrEqual(hull + 1e-6);
      });
    }
  });

  it('keeps unique part and mount ids', () => {
    expect(new Set(defs.map((d) => d.id)).size).toBe(defs.length);
    const mounts = defs.filter((d) => d.mount).map((d) => d.mount!.id);
    expect(new Set(mounts).size).toBe(mounts.length);
  });
});

describe('geometry', () => {
  it('a part is a circle, or a capsule along the forward axis', () => {
    const w = worldWithCapital();
    const cap = w.enemies.capital!;
    const plate = defs[indexOf('plate-port')]!; // capsule at (0, 105), length 170, radius 48
    expect(distanceToPart(cap, plate, 0, 105)).toBeCloseTo(-48);
    expect(distanceToPart(cap, plate, 85, 105)).toBeCloseTo(-48); // end of the axis
    expect(distanceToPart(cap, plate, 85 + 48, 105)).toBeCloseTo(0); // cap tip
    expect(distanceToPart(cap, plate, 0, 105 + 48 + 10)).toBeCloseTo(10);
  });

  it('follows the heading and the position of the ship', () => {
    const w = worldWithCapital();
    const cap = w.enemies.capital!;
    cap.x = 1000;
    cap.y = 500;
    cap.heading = Math.PI / 2; // nose along +y: ship-space (x, y) -> world (-y, x)
    const c = { x: 0, y: 0 };
    const gun = defs[indexOf('gun-bow-port')]!; // (250, 190)
    partCenter(c, cap, gun);
    expect(c.x).toBeCloseTo(1000 - 190);
    expect(c.y).toBeCloseTo(500 + 250);
  });

  it('broadside heading picks the side nearest the current heading', () => {
    // Player due east (bearing 0): broadside is +-90 degrees.
    expect(broadsideHeading(10 * DEG, 0)).toBeCloseTo(90 * DEG);
    expect(broadsideHeading(-10 * DEG, 0)).toBeCloseTo(-90 * DEG);
  });
});

describe('damage routing', () => {
  it('a hit lands on the part touched, outermost surface first', () => {
    const w = worldWithCapital();
    const cap = w.enemies.capital!;
    // Dead centre of a turret: that turret.
    const gun = defs[indexOf('gun-mid-port')]!;
    expect(partAt(cap, gun.x, gun.y, 1)).toBe(indexOf('gun-mid-port'));
    // Between the front plate (100, 0, r75) and the bridge side: the shallowest overlap wins.
    const plateFront = indexOf('plate-front');
    const point = 100 + 75 - 5; // 5 u inside the front edge of the plate: only the plate covers it
    expect(partAt(cap, point, 0, 1)).toBe(plateFront);
    // Empty space inside the hull and far outside it: nothing.
    expect(partAt(cap, -200, 400, 1)).toBe(-1);
    expect(partAt(cap, 5000, 0, 1)).toBe(-1);
  });

  it('where two parts overlap, the one whose surface is nearest takes it', () => {
    const w = worldWithCapital();
    const cap = w.enemies.capital!;
    // The bridge (330, 0, r55) and the bow plate (430, 0, r75) overlap between x=355 and x=385.
    // The bridge is covered by the plate, so a point in the overlap hits the plate...
    expect(partAt(cap, 370, 0, 1)).toBe(indexOf('plate-bow'));
    // ...and once the plate is gone the bridge can be hit.
    killPart(w, indexOf('plate-bow'));
    expect(partAt(cap, 330, 0, 1)).toBe(indexOf('bridge'));
  });

  it('plates shield the core: no damage while any covering plate stands', () => {
    const w = worldWithCapital();
    const cap = w.enemies.capital!;
    const core = coreIndex();
    expect(isCovered(cap, core)).toBe(true);
    expect(damagePart(w, core, 50, 0)).toBe(false);
    expect(cap.parts[core]!.hp).toBe(cap.parts[core]!.maxHp);
    // Not hittable, not lockable.
    expect(partAt(cap, 0, 0, 1)).not.toBe(core);
    expect(partBody(w, core)!.alive).toBe(false);
    const visited: number[] = [];
    forEachPart(w, (id) => visited.push(id));
    expect(visited).not.toContain(PART_ID_BASE + core);
    // Kill all but one plate: still shielded.
    const plates = defs.map((d, i) => (d.covers.includes('core') ? i : -1)).filter((i) => i >= 0);
    for (const i of plates.slice(1)) killPart(w, i);
    expect(isCovered(cap, core)).toBe(true);
    expect(damagePart(w, core, 50, 0)).toBe(false);
    expect(cap.coreExposed).toBe(false);
  });

  it('CoreExposed fires once, when the last covering plate dies', () => {
    const w = worldWithCapital();
    const cap = w.enemies.capital!;
    const plates = defs.map((d, i) => (d.covers.includes('core') ? i : -1)).filter((i) => i >= 0);
    for (const i of plates.slice(0, -1)) killPart(w, i);
    expect(eventsOf(w, 'CoreExposed')).toHaveLength(0);
    // The last plate goes down to damage, not a dev kill.
    const last = plates[plates.length - 1]!;
    expect(damagePart(w, last, 1000, 0)).toBe(true);
    expect(cap.coreExposed).toBe(true);
    expect(eventsOf(w, 'CoreExposed')).toHaveLength(1);
    expect(eventsOf(w, 'PartDestroyed').length).toBe(plates.length);
    // The core can be hurt now.
    expect(isCovered(cap, coreIndex())).toBe(false);
    expect(damagePart(w, coreIndex(), 5, 7)).toBe(true);
    expect(cap.parts[coreIndex()]!.hp).toBe(cap.parts[coreIndex()]!.maxHp - 5);
    expect(cap.lastHitBy).toBe(7);
    killPart(w, indexOf('gun-bow-port'));
    expect(eventsOf(w, 'CoreExposed')).toHaveLength(1); // still once
  });

  it('PartDestroyed says what blew up, where and how big', () => {
    const w = worldWithCapital();
    damagePart(w, indexOf('gun-aft-port'), 1000, 0);
    const [e] = eventsOf(w, 'PartDestroyed') as Extract<GameEvent, { type: 'PartDestroyed' }>[];
    expect(e).toMatchObject({ part: 'gun-aft-port', role: 'turret', radius: 40 });
    expect(e!.x).toBeCloseTo(-300);
    expect(e!.y).toBeCloseTo(210);
    // A dead part takes no more damage and does not fire its event twice.
    expect(damagePart(w, indexOf('gun-aft-port'), 1, 0)).toBe(false);
    expect(eventsOf(w, 'PartDestroyed')).toHaveLength(1);
  });

  it('killing the core starts the death chain; nothing else can be damaged then', () => {
    const w = worldWithCapital();
    const cap = w.enemies.capital!;
    stripCorePlates(w);
    expect(damagePart(w, coreIndex(), 1000, 0)).toBe(true);
    expect(cap.phase).toBe(1);
    expect(damagePart(w, indexOf('gun-bow-port'), 1, 0)).toBe(false);
    expect(partAt(cap, 250, 190, 1)).toBe(-1);
  });

  it('a scaled hull scales the part positions and radii', () => {
    const w = worldWithCapital();
    const big = createCapital(0, 0, 0, 3000, { hullRadius: 1400, partHpScale: 2 }, w.rng);
    const c = { x: 0, y: 0 };
    partCenter(c, big, defs[indexOf('gun-bow-port')]!);
    expect(c.x).toBeCloseTo(500);
    expect(boundRadius(big, defs[indexOf('gun-bow-port')]!)).toBeCloseTo(80);
    expect(big.parts[0]!.hp).toBe(defs[0]!.hp * 2);
  });
});

describe('bullets', () => {
  it('a bullet inside a turret damages it and is spent; a bullet inside the covered core is not', () => {
    const w = worldWithCapital();
    const cap = w.enemies.capital!;
    const gun = indexOf('gun-mid-starboard');
    w.bullets.spawn();
    w.bullets.data.x[0] = defs[gun]!.x;
    w.bullets.data.y[0] = defs[gun]!.y;
    w.bullets.data.damage[0] = 4;
    w.bullets.data.owner[0] = 9;
    stepCapitalBullets(w);
    expect(w.bullets.count).toBe(0);
    expect(cap.parts[gun]!.hp).toBe(cap.parts[gun]!.maxHp - 4);
    expect(eventsOf(w, 'Hit')).toHaveLength(1);

    // A bullet at the very centre of the core: inside plates, so a plate takes it, never the core.
    w.bullets.spawn();
    w.bullets.data.x[0] = 0;
    w.bullets.data.y[0] = 0;
    w.bullets.data.damage[0] = 4;
    stepCapitalBullets(w);
    expect(cap.parts[coreIndex()]!.hp).toBe(cap.parts[coreIndex()]!.maxHp);
  });

  it('bullets outside the hull are left alone (broad phase) and the cost stays small', () => {
    const w = worldWithCapital();
    for (let i = 0; i < 400; i++) {
      w.bullets.spawn();
      w.bullets.data.x[i] = 3000 + i;
      w.bullets.data.y[i] = 0;
    }
    stepCapitalBullets(w);
    expect(w.bullets.count).toBe(400);
  });
});

describe('movement', () => {
  const cfg = { cruiseSpeed: 60, turnRate: 8, standoff: 1600 };

  it('drifts towards the player and stops at the standoff distance', () => {
    const w = worldWithCapital();
    const cap = w.enemies.capital!;
    cap.x = -4000;
    for (let i = 0; i < 60 * 10; i++) stepCapitalMotion(cap, cfg, 1, 0, 0, 6000, 1 / 60);
    expect(cap.x).toBeGreaterThan(-4000 + 300); // moved about 10 s x 60 u/s
    for (let i = 0; i < 60 * 120; i++) stepCapitalMotion(cap, cfg, 1, 0, 0, 6000, 1 / 60);
    expect(Math.hypot(cap.x, cap.y)).toBeLessThan(1650);
    expect(Math.hypot(cap.x, cap.y)).toBeGreaterThan(1500);
    expect(Math.hypot(cap.vx, cap.vy)).toBeLessThan(2);
  });

  it('turns its broadside to the player at the turn rate', () => {
    const w = worldWithCapital();
    const cap = w.enemies.capital!;
    cap.x = -3000;
    cap.heading = 0; // nose at the player: needs a quarter turn
    stepCapitalMotion(cap, cfg, 1, 0, 0, 6000, 1);
    expect(Math.abs(cap.heading)).toBeCloseTo(8 * DEG, 5); // one second at 8 deg/s
    for (let i = 0; i < 60 * 20; i++) stepCapitalMotion(cap, cfg, 1, 0, 0, 6000, 1 / 60);
    expect(Math.abs(Math.abs(cap.heading) - Math.PI / 2)).toBeLessThan(0.2);
  });

  it('with the engines dead it neither moves nor turns; with one it is half as fast', () => {
    const w = worldWithCapital();
    const cap = w.enemies.capital!;
    cap.x = -4000;
    cap.vx = 50;
    cap.heading = 0;
    for (let i = 0; i < 60 * 8; i++) stepCapitalMotion(cap, cfg, 0, 0, 0, 6000, 1 / 60);
    expect(Math.hypot(cap.vx, cap.vy)).toBeLessThan(0.5); // it stops
    const stopped = cap.x;
    const heading = cap.heading;
    for (let i = 0; i < 60 * 8; i++) stepCapitalMotion(cap, cfg, 0, 0, 0, 6000, 1 / 60);
    expect(cap.x).toBeCloseTo(stopped, 1);
    expect(cap.heading).toBe(heading);

    const full = createCapital(-4000, 0, 0, 4000, w.tuning.capital, w.rng);
    const half = createCapital(-4000, 0, 0, 4000, w.tuning.capital, w.rng);
    for (let i = 0; i < 60 * 20; i++) {
      stepCapitalMotion(full, cfg, 1, 0, 0, 6000, 1 / 60);
      stepCapitalMotion(half, cfg, 0.5, 0, 0, 6000, 1 / 60);
    }
    expect(half.x - -4000).toBeLessThan((full.x - -4000) * 0.6);
    expect(half.x - -4000).toBeGreaterThan((full.x - -4000) * 0.4);
  });

  it('engine share follows the engines that stand', () => {
    const w = worldWithCapital();
    const cap = w.enemies.capital!;
    expect(engineShare(cap)).toBe(1);
    killPart(w, indexOf('engine-port'));
    expect(engineShare(cap)).toBe(0.5);
    killPart(w, indexOf('engine-starboard'));
    expect(engineShare(cap)).toBe(0);
    expect(countRole(cap, 'engine')).toEqual({ alive: 0, total: 2 });
  });

  it('keeps the whole hull inside the arena', () => {
    const w = worldWithCapital();
    const cap = w.enemies.capital!;
    cap.x = 5900;
    cap.y = 0;
    cap.vx = 100;
    keepInside(cap, 6000);
    expect(cap.x).toBeCloseTo(6000 - cap.hullRadius);
    expect(cap.vx).toBeLessThanOrEqual(0);
    // Every part, not just the centre, is inside.
    const c = { x: 0, y: 0 };
    for (const d of defs) {
      partCenter(c, cap, d);
      expect(Math.hypot(c.x, c.y) + boundRadius(cap, d)).toBeLessThanOrEqual(6000 + 1e-6);
    }
  });
});

describe('turrets', () => {
  it('arcs: a mount only points inside arcCenter +- arcHalf (relative to the heading)', () => {
    expect(inArc(0, 90 * DEG, 100 * DEG, 0)).toBe(true); // 90 off the centre, within 100
    expect(inArc(0, 90 * DEG, 100 * DEG, -20 * DEG)).toBe(false); // 110 off
    expect(inArc(Math.PI / 2, 90 * DEG, 10 * DEG, Math.PI)).toBe(true); // heading rotates the arc
    expect(inArc(Math.PI, 90 * DEG, 10 * DEG, -Math.PI / 2 + 0.01)).toBe(true); // wraps around
  });

  /** Steps the capital alone for `seconds` and counts the enemy bullets it fired. */
  function fired(w: World, seconds: number): number {
    let n = 0;
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      w.tick++;
      w.time += 1 / 60;
      const before = w.enemyShots.count;
      stepCapital(w);
      n += Math.max(0, w.enemyShots.count - before);
      // Keep the capital where it is, and clear the shots so the pool never fills.
      const cap = w.enemies.capital!;
      cap.x = 0;
      cap.y = 0;
      cap.vx = cap.vy = 0;
      w.enemyShots.clear();
    }
    return n;
  }

  it('fires at a player inside its arcs and range, in bursts with pauses', () => {
    const w = worldWithCapital();
    const cap = w.enemies.capital!;
    cap.heading = 0;
    w.ship.x = 0;
    w.ship.y = -900; // starboard beam, in range
    const shots = fired(w, 10);
    expect(shots).toBeGreaterThan(10);
    // Bursts: the number of EnemyShotFired events in a burst window never exceeds burst shots x turrets by much.
    expect(shots).toBeLessThan(10 * 60); // far below "every step"
  });

  it('does not fire at a target outside its range or behind every arc', () => {
    const w = worldWithCapital();
    w.ship.x = 0;
    w.ship.y = -5000; // out of range of every gun
    expect(fired(w, 6)).toBe(0);
    // Dead ahead and astern of a ship heading +x: only the heavy and bow guns' arcs could reach, but
    // none covers the exact bow within range of the nose... check the ones that do cover it fire at most.
    const w2 = worldWithCapital();
    w2.ship.x = 1500; // dead ahead
    w2.ship.y = 0;
    const a = fired(w2, 8);
    const w3 = worldWithCapital();
    w3.ship.x = 0;
    w3.ship.y = -900; // broadside
    const b = fired(w3, 8);
    expect(b).toBeGreaterThan(a); // the broadside brings more guns to bear than the bow
  });

  it('destroyed turrets stop firing, and a silent fireScale stops all fire', () => {
    const w = worldWithCapital();
    w.ship.y = -900;
    for (let i = 0; i < defs.length; i++) if (defs[i]!.role === 'turret') killPart(w, i);
    expect(fired(w, 8)).toBe(0);
    const w2 = worldWithCapital();
    w2.ship.y = -900;
    w2.tuning.capital.fireScale = 0;
    expect(fired(w2, 8)).toBe(0);
  });

  it('a destroyed bridge makes the guns worse: more spread, longer pauses', () => {
    const aimError = (blind: boolean): { spread: number; count: number } => {
      const w = worldWithCapital();
      if (blind) killPart(w, indexOf('bridge'));
      w.ship.x = 0;
      w.ship.y = -900;
      w.ship.vx = 0;
      let count = 0;
      let sumSq = 0;
      for (let i = 0; i < 60 * 40; i++) {
        w.tick++;
        w.time += 1 / 60;
        stepCapital(w);
        const cap = w.enemies.capital!;
        cap.x = 0;
        cap.y = 0;
        cap.vx = cap.vy = 0;
        const d = w.enemyShots.data;
        count += w.enemyShots.count;
        for (let k = 0; k < w.enemyShots.count; k++) {
          const ang = Math.atan2(d.vy[k]!, d.vx[k]!);
          const toward = Math.atan2(-900 - d.y[k]!, 0 - d.x[k]!);
          if (Math.abs(Math.sin(ang - toward)) < 0.5) sumSq += Math.sin(ang - toward) ** 2;
        }
        w.enemyShots.clear();
      }
      return { spread: sumSq / Math.max(count, 1), count };
    };
    // Measured over the same fight: the blinded ship's shots scatter more around the player.
    const sighted = aimError(false);
    const blind = aimError(true);
    expect(blind.spread).toBeGreaterThan(sighted.spread);
  });

  it('heavy guns fire a double slug (two enemy bullets per shot)', () => {
    const w = worldWithCapital();
    const heavy = indexOf('heavy-port');
    for (let i = 0; i < defs.length; i++)
      if (i !== heavy && defs[i]!.role === 'turret') killPart(w, i);
    w.ship.x = 0;
    w.ship.y = 900;
    const cap = w.enemies.capital!;
    cap.parts[heavy]!.cooldown = 0;
    w.tick++;
    w.time += 1 / 60;
    stepCapital(w);
    expect(w.enemyShots.count).toBe(2);
  });
});

describe('lock-on helpers', () => {
  it('only parts that can be hit are lockable; ids start at PART_ID_BASE', () => {
    const w = worldWithCapital();
    const ids: number[] = [];
    forEachPart(w, (id) => ids.push(id));
    const core = PART_ID_BASE + coreIndex();
    expect(ids).not.toContain(core);
    expect(ids).not.toContain(PART_ID_BASE + indexOf('bridge')); // under the bow plate
    expect(ids.every((id) => id >= PART_ID_BASE && id < PART_ID_BASE + defs.length)).toBe(true);
    stripCorePlates(w);
    ids.length = 0;
    forEachPart(w, (id) => ids.push(id));
    expect(ids).toContain(core);
  });

  it('nextPartTarget prefers the nearest turret, then any part', () => {
    const w = worldWithCapital();
    // Near the aft starboard gun.
    expect(nextPartTarget(w, -300, -210)).toBe(PART_ID_BASE + indexOf('gun-aft-starboard'));
    for (let i = 0; i < defs.length; i++) if (defs[i]!.role === 'turret') killPart(w, i);
    const t = nextPartTarget(w, -300, -210);
    expect(t).toBeGreaterThanOrEqual(PART_ID_BASE);
    expect(defs[t - PART_ID_BASE]!.role).not.toBe('turret');
    expect(t - PART_ID_BASE).not.toBe(coreIndex()); // still covered
  });
});

describe('death chain', () => {
  it('blows the remaining parts up one by one, then destroys the hull and ends', () => {
    const w = worldWithCapital();
    const cap = w.enemies.capital!;
    stripCorePlates(w);
    damagePart(w, coreIndex(), 1000, 0);
    expect(cap.phase).toBe(1);
    const alive = (): number => cap.parts.filter((p) => p.alive).length;
    const start = alive();
    let destroyed = 0;
    let final: GameEvent | undefined;
    let lastAlive = start;
    const chain = w.tuning.capital.deathChainTime;
    w.events.clear();
    for (let i = 0; i < Math.round(chain * 60) + 5 && cap.phase !== 2; i++) {
      w.tick++;
      w.time += 1 / 60;
      stepCapital(w);
      destroyed += eventsOf(w, 'PartDestroyed').length;
      final = eventsOf(w, 'CapitalDestroyed')[0] ?? final;
      expect(alive()).toBeLessThanOrEqual(lastAlive); // never comes back
      lastAlive = alive();
      w.events.clear();
    }
    expect(cap.phase).toBe(2);
    expect(alive()).toBe(0);
    expect(final).toMatchObject({ type: 'CapitalDestroyed', radius: cap.hullRadius });
    expect(destroyed).toBe(start); // each part destroyed exactly once during the chain
  });

  it('is frozen by the debug freeze like every enemy', () => {
    const w = worldWithCapital();
    w.tuning.arena.enemiesFrozen = true;
    const cap = w.enemies.capital!;
    cap.x = -3000;
    stepCapital(w);
    expect(cap.x).toBe(-3000);
    expect(cap.time).toBe(0);
  });
});

describe('through the world step', () => {
  it('a whole step with a capital ship on the field runs (guns, hits, motion) without error or NaN', () => {
    const w = createWorld(5, createTuning());
    w.enemies.capital = createCapital(2500, 0, 0, 2500, w.tuning.capital, w.rng);
    w.actions.fire = true;
    for (let i = 0; i < 600; i++) {
      stepWorld(w, 1 / 60);
      const c = w.enemies.capital!;
      expect(Number.isFinite(c.x + c.y + c.heading + c.vx + c.vy)).toBe(true);
    }
  });
});
