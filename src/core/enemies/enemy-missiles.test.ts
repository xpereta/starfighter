import { describe, expect, it } from 'vitest';
import { createTuning } from '../../../data/tuning';
import { DEG } from '../math';
import { createWorld, type World } from '../world/world';
import { accelerate, launchEnemyMissile, stepEnemyMissiles, steerHeading } from './enemy-missiles';

const DT = 1 / 60;

function world(): World {
  const w = createWorld(3, createTuning());
  w.ship.x = 0;
  w.ship.y = 0;
  w.ship.speed = 300;
  return w;
}

/** One step of the enemy missiles only (the clock advances like `stepWorld` would). Returns the damage. */
function step(w: World): number {
  w.events.clear();
  w.tick += 1;
  w.time += DT;
  return stepEnemyMissiles(w);
}

const types = (w: World): string[] => w.events.events.map((e) => e.type);
const hitKinds = (w: World): string[] =>
  w.events.events.flatMap((e) => (e.type === 'EnemyMissileHit' ? [e.hit] : []));

describe('steerHeading and accelerate', () => {
  it('turns toward the wanted heading by at most the limit, the short way round', () => {
    expect(steerHeading(0, 1, 0.1)).toBeCloseTo(0.1);
    expect(steerHeading(0, -1, 0.1)).toBeCloseTo(-0.1);
    expect(steerHeading(0, 0.05, 0.1)).toBeCloseTo(0.05);
    // From just below +pi to just above -pi is a small left turn, not a full circle.
    expect(steerHeading(3.1, -3.1, 0.05)).toBeCloseTo(3.15);
  });
  it('speeds up and stops at the top speed', () => {
    expect(accelerate(100, 600, 650, 0.5)).toBeCloseTo(400);
    expect(accelerate(600, 600, 650, 0.5)).toBe(650);
  });
});

describe('launchEnemyMissile', () => {
  it('fills a slot with the launch values, a fresh uid and emits EnemyMissileFired', () => {
    const w = world();
    const cfg = w.tuning.lancer;
    expect(launchEnemyMissile(w, 100, 200, 0.5, 4)).toBe(true);
    expect(launchEnemyMissile(w, 100, 200, 0.5, 4)).toBe(true);
    const d = w.enemies.missiles.data;
    expect(w.enemies.missiles.count).toBe(2);
    expect([d.uid[0], d.uid[1]]).toEqual([0, 1]);
    expect(d.speed[0]).toBe(cfg.launchSpeed);
    expect(d.life[0]).toBe(cfg.missileLife);
    expect(d.damage[0]).toBe(cfg.missileDamage);
    expect(d.owner[0]).toBe(4);
    expect(d.phase[0]).toBe(0);
    expect(w.events.events[0]).toMatchObject({ type: 'EnemyMissileFired', x: 100, y: 200 });
    expect((w.events.events[0] as { angle: number }).angle).toBeCloseTo(0.5);
  });
  it('drops the missile without an event when the pool is full', () => {
    const w = world();
    for (let i = 0; i < w.enemies.missiles.capacity; i++) launchEnemyMissile(w, 0, 0, 0, 0);
    w.events.clear();
    expect(launchEnemyMissile(w, 0, 0, 0, 0)).toBe(false);
    expect(w.events.events).toEqual([]);
    expect(w.enemies.missiles.count).toBe(w.enemies.missiles.capacity);
  });
});

describe('flight', () => {
  it('accelerates from the slow launch up to the top speed', () => {
    const w = world();
    const cfg = w.tuning.lancer;
    w.ship.x = 1e6; // far away: nothing hits
    launchEnemyMissile(w, 0, 0, 0, 0);
    step(w);
    const d = w.enemies.missiles.data;
    expect(d.speed[0]).toBeCloseTo(cfg.launchSpeed + cfg.missileAccel * DT);
    for (let i = 0; i < 600; i++) step(w);
    expect(d.speed[0]).toBe(cfg.missileMaxSpeed);
  });

  it('turns toward the player no faster than the turn rate', () => {
    const w = world();
    const cfg = w.tuning.lancer;
    w.ship.x = 0;
    w.ship.y = 5000; // straight up, the missile points along +x
    launchEnemyMissile(w, 0, 0, 0, 0);
    const d = w.enemies.missiles.data;
    let last = d.heading[0]!;
    for (let i = 0; i < 20; i++) {
      step(w);
      const turned = d.heading[0]! - last;
      expect(turned).toBeLessThanOrEqual(cfg.missileTurnRate * DEG * DT + 1e-6);
      expect(turned).toBeGreaterThan(0);
      last = d.heading[0]!;
    }
  });

  it('a missile pointing away from the player needs time to turn, so it does not hit at once', () => {
    const w = world();
    w.ship.x = 400;
    launchEnemyMissile(w, 0, 0, Math.PI, 0); // nose pointing the wrong way
    for (let i = 0; i < 30; i++) step(w);
    expect(w.enemies.missiles.count).toBe(1);
    expect(w.stats.hitsTaken).toBe(0);
  });

  it('emits exactly one expired event at the burn-out', () => {
    const w = world();
    w.ship.x = 1e6;
    launchEnemyMissile(w, 0, 0, 0, 0);
    let expired = 0;
    for (let i = 0; i < 400; i++) {
      step(w);
      expired += hitKinds(w).filter((k) => k === 'expired').length;
    }
    expect(expired).toBe(1);
    expect(w.enemies.missiles.count).toBe(0);
  });
});

describe('hits', () => {
  it('a missile on the player does its damage, shakes, and is removed (run: charged via the return value)', () => {
    const w = world();
    w.run.mode = 'run';
    w.run.hull = 5;
    launchEnemyMissile(w, 10, 0, 0, 0); // right on the ship
    const dmg = step(w);
    expect(dmg).toBe(w.tuning.lancer.missileDamage);
    expect(w.enemies.missiles.count).toBe(0);
    expect(types(w)).toEqual(['Hit', 'PlayerDamaged', 'EnemyMissileHit']);
    expect(hitKinds(w)).toEqual(['player']);
    const damaged = w.events.events.find((e) => e.type === 'PlayerDamaged');
    expect(damaged).toMatchObject({ hull: 5 - w.tuning.lancer.missileDamage });
    const hit = w.events.events.find((e) => e.type === 'Hit');
    expect(hit).toMatchObject({ impulse: w.tuning.lancer.hitImpulse });
    expect(w.ship.speed).toBe(300); // a run hit costs hull, not speed
  });

  it('two missiles in one step add up, and the hull in the event counts both', () => {
    const w = world();
    w.run.mode = 'run';
    w.run.hull = 5;
    launchEnemyMissile(w, 10, 0, 0, 0);
    launchEnemyMissile(w, -10, 0, 0, 0);
    expect(step(w)).toBe(2 * w.tuning.lancer.missileDamage);
    const hulls = w.events.events.flatMap((e) => (e.type === 'PlayerDamaged' ? [e.hull] : []));
    expect(hulls).toEqual([3, 1]);
  });

  it('the evade roll beats it: no damage, the missile is spent, an immune event', () => {
    const w = world();
    w.ship.invulnerable = true;
    launchEnemyMissile(w, 10, 0, 0, 0);
    expect(step(w)).toBe(0);
    expect(w.enemies.missiles.count).toBe(0);
    expect(types(w)).toEqual(['EnemyMissileHit']);
    expect(hitKinds(w)).toEqual(['immune']);
  });

  it('practice mode has no hull: the hit is counted and costs speed (never below the minimum)', () => {
    const w = world();
    expect(w.run.mode).toBe('practice');
    launchEnemyMissile(w, 10, 0, 0, 0);
    expect(step(w)).toBe(w.tuning.lancer.missileDamage);
    expect(w.ship.speed).toBe(300 - w.tuning.lancer.practiceKnock);
    const slow = world();
    slow.ship.speed = slow.tuning.flight.minSpeed + 10;
    launchEnemyMissile(slow, 10, 0, 0, 0);
    step(slow);
    expect(slow.ship.speed).toBe(slow.tuning.flight.minSpeed);
    expect(types(w)).toContain('PlayerDamaged');
    expect(w.events.events.find((e) => e.type === 'PlayerDamaged')).toMatchObject({ hull: 0 });
  });

  it('a missile that is just too far does not hit', () => {
    const w = world();
    const reach = w.tuning.arena.playerRadius + w.tuning.lancer.missileRadius;
    // Moving away from the ship after launch (heading +x, ship to the left would be turned toward).
    launchEnemyMissile(w, reach + 40, 0, 0, 0);
    expect(step(w)).toBe(0);
  });
});
