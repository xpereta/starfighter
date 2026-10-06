import { describe, expect, it } from 'vitest';
import { CAPITAL_PARTS } from '../../../data/content/capital';
import { createTuning } from '../../../data/tuning';
import { stepLockOn } from '../lockon/lockon';
import { attackTarget, stepOrders } from '../squadron/orders';
import { bodyOf } from '../squadron/wingmen';
import { getLockable, PART_ID_BASE } from '../world/lockable';
import { createWorld, stepWorld, type World } from '../world/world';
import { createCapital, damagePart, killPart, partCenter } from './capital';

const defs = CAPITAL_PARTS;
const indexOf = (id: string): number => defs.findIndex((d) => d.id === id);
const DT = 1 / 60;

/** The capital ship 900 u east of the player, heading 0, quiet guns, one wingman. */
function arena(): World {
  const tuning = createTuning();
  tuning.capital.fireScale = 0;
  tuning.lockon.lockTime = 0.05;
  const w = createWorld(8, tuning);
  w.ship.x = 0;
  w.ship.y = 0;
  w.ship.heading = 0;
  w.enemies.capital = createCapital(900, 0, 0, 900, w.tuning.capital, w.rng);
  w.targets.length = 0;
  stepWorld(w, DT); // creates the wingmen
  return w;
}

/** Puts one missile on the field at the ship, flying east, homing on `targetId` (-1 = none). */
function launchOne(w: World, targetId: number, x = w.ship.x + 50, y = w.ship.y): void {
  const m = w.missiles;
  const i = m.spawn();
  m.data.x[i] = x;
  m.data.y[i] = y;
  m.data.heading[i] = 0;
  m.data.speed[i] = 400;
  m.data.vx[i] = 400;
  m.data.life[i] = w.tuning.missiles.missileLife;
  m.data.targetId[i] = targetId;
  m.data.damageScale[i] = 1;
}

function aimAt(w: World, id: string): void {
  const c = { x: 0, y: 0 };
  partCenter(c, w.enemies.capital!, defs[indexOf(id)]!);
  w.ship.heading = Math.atan2(c.y - w.ship.y, c.x - w.ship.x);
}

describe('lock-on on parts', () => {
  it('locks a part in the cone, with a lockable id from PART_ID_BASE up, and never the covered core', () => {
    const w = arena();
    aimAt(w, 'gun-bow-port');
    for (let i = 0; i < 60; i++) stepLockOn(w);
    expect(w.lockon.locks.length).toBeGreaterThan(0);
    expect(w.lockon.locks[0]).toBeGreaterThanOrEqual(PART_ID_BASE);
    expect(w.lockon.locks).not.toContain(PART_ID_BASE + indexOf('core'));
    // The id resolves to a body with the part's hit points.
    const id = w.lockon.locks[0]! - PART_ID_BASE;
    const body = getLockable(w, w.lockon.locks[0]!)!;
    expect(body.alive).toBe(true);
    expect(body.hp).toBe(defs[id]!.hp);
  });

  it('holds at most lockPartCap parts, whatever the lock limit', () => {
    const w = arena();
    w.tuning.lockon.lockCap = 5;
    w.tuning.lockon.coneHalfAngle = 80; // a wide cone sees many parts
    w.squadron.wingmen.forEach((m) => (m.alive = true));
    for (const cap of [1, 2]) {
      w.tuning.capital.lockPartCap = cap;
      w.lockon.locks.length = 0;
      w.lockon.graces.length = 0;
      w.lockon.acquiringId = -1;
      for (let i = 0; i < 200; i++) stepLockOn(w);
      expect(w.lockon.locks.filter((id) => id >= PART_ID_BASE).length).toBeLessThanOrEqual(cap);
    }
  });

  it('a lock on a part that dies is dropped as dead', () => {
    const w = arena();
    aimAt(w, 'gun-bow-port');
    for (let i = 0; i < 60; i++) stepLockOn(w);
    const id = w.lockon.locks[0]!;
    killPart(w, id - PART_ID_BASE);
    w.events.clear();
    stepLockOn(w);
    expect(w.lockon.locks).not.toContain(id);
    expect(w.events.events.some((e) => e.type === 'LockLost' && e.reason === 'dead')).toBe(true);
  });
});

describe('missiles on parts', () => {
  it('a missile locked on a part hits that part for the missile damage', () => {
    const w = arena();
    const gun = indexOf('gun-bow-port');
    const hp = w.enemies.capital!.parts[gun]!.hp;
    launchOne(w, PART_ID_BASE + gun, 950, 190); // a clear run at the gun, no plate in the way
    for (let i = 0; i < 240 && w.missiles.count > 0; i++) {
      stepWorld(w, DT);
    }
    expect(w.missiles.count).toBe(0);
    expect(w.enemies.capital!.parts[gun]!.hp).toBe(hp - w.tuning.missiles.missileDamage);
  });

  it('a missile that flies into a covered part does nothing to it (a plate takes it)', () => {
    const w = arena();
    const core = indexOf('core');
    const hp = w.enemies.capital!.parts[core]!.hp;
    // Straight at the core's centre, no lock: the plates around it are hit first.
    launchOne(w, -1);
    for (let i = 0; i < 240; i++) stepWorld(w, DT);
    expect(w.enemies.capital!.parts[core]!.hp).toBe(hp);
    const plates = defs
      .map((d, i) => (d.covers.includes('core') ? i : -1))
      .filter((i) => i >= 0)
      .map((i) => w.enemies.capital!.parts[i]!.hp < defs[i]!.hp);
    expect(plates.some(Boolean)).toBe(true);
  });
});

describe('attack orders and wingmen on parts', () => {
  it('the attack target is the part the nose points at', () => {
    const w = arena();
    aimAt(w, 'gun-mid-port');
    expect(attackTarget(w)).toBe(PART_ID_BASE + indexOf('gun-mid-port'));
  });

  it('bodyOf resolves part ids, alive until the part dies', () => {
    const w = arena();
    const id = PART_ID_BASE + indexOf('gun-mid-port');
    expect(bodyOf(w, id)?.alive).toBe(true);
    killPart(w, indexOf('gun-mid-port'));
    expect(bodyOf(w, id)?.alive).toBe(false);
  });

  it('the order moves on to the nearest turret when its part dies, and ends when nothing is left', () => {
    const w = arena();
    const sq = w.squadron;
    sq.order = 'attack';
    sq.orderTimer = 8;
    sq.orderTargetId = PART_ID_BASE + indexOf('gun-mid-port');
    w.tick++;
    w.time += DT;
    damagePart(w, indexOf('gun-mid-port'), 1000, 0);
    stepOrders(w);
    expect(sq.order).toBe('attack');
    const next = sq.orderTargetId;
    expect(next).toBeGreaterThanOrEqual(PART_ID_BASE);
    expect(next).not.toBe(PART_ID_BASE + indexOf('gun-mid-port'));
    expect(defs[next - PART_ID_BASE]!.role).toBe('turret');
    // Kill the whole ship: the order ends.
    for (let i = 0; i < defs.length; i++) killPart(w, i);
    stepOrders(w);
    expect(sq.order).toBe('none');
    expect(sq.orderTargetId).toBe(-1);
  });

  it('wingmen engage the capital ship nearest turret when it is in range', () => {
    const w = arena();
    w.enemies.capital!.x = 400; // within the wingmen engage range
    for (let i = 0; i < 30; i++) stepWorld(w, DT);
    const engaged = w.squadron.wingmen.filter((m) => m.alive && m.engagedId >= PART_ID_BASE);
    expect(engaged.length).toBeGreaterThan(0);
    for (const m of engaged) {
      expect(defs[m.engagedId - PART_ID_BASE]!.role).toBe('turret');
    }
  });
});
