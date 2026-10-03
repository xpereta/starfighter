import { describe, expect, it } from 'vitest';
import { createFlightConfig } from '../../../data/tuning/flight';
import { createWeaponsConfig, type WeaponsConfig } from '../../../data/tuning/weapons';
import { createEventQueue } from '../events/events';
import { createShip } from '../flight/flight';
import { DEG } from '../math';
import { createRng } from '../rng/rng';
import { createActions } from '../world/actions';
import type { Collider } from '../world/target';
import { createBulletPool, createGunState, stepBullets, stepGuns } from './guns';

const DT = 1 / 60;

function setup(over: Partial<WeaponsConfig> = {}) {
  const cfg = { ...createWeaponsConfig(), ...over };
  const ship = createShip(createFlightConfig());
  const actions = { ...createActions(), fire: true };
  return {
    cfg,
    ship,
    actions,
    state: createGunState(),
    bullets: createBulletPool(cfg),
    events: createEventQueue(),
    rng: createRng(5),
  };
}
type Ctx = ReturnType<typeof setup>;
const fire = (c: Ctx): void =>
  stepGuns(c.state, c.bullets, c.ship, c.actions, c.cfg, c.rng, c.events, DT);

describe('stepGuns', () => {
  it('fires at the configured rate (12 shots in one second)', () => {
    const c = setup({ fireRate: 12 });
    for (let i = 0; i < 60; i++) fire(c);
    const shots = c.events.events.filter((e) => e.type === 'ShotFired').length;
    expect(shots).toBe(12);
  });

  it('does not fire without the fire action', () => {
    const c = setup();
    c.actions.fire = false;
    for (let i = 0; i < 30; i++) fire(c);
    expect(c.bullets.count).toBe(0);
  });

  it('bullets inherit the ship velocity', () => {
    const c = setup({ spread: 0 });
    c.ship.heading = Math.PI / 2;
    c.ship.vx = 100;
    c.ship.vy = 250;
    fire(c);
    expect(c.bullets.count).toBe(1);
    expect(c.bullets.data.vx[0]).toBeCloseTo(100, 3);
    expect(c.bullets.data.vy[0]).toBeCloseTo(250 + c.cfg.bulletSpeed, 3);
  });

  it('alternates barrels left and right of the nose', () => {
    const c = setup({ spread: 0 }); // heading 0 (+x): sideways is y
    for (let i = 0; i < 20; i++) fire(c);
    const ys = c.events.events.flatMap((e) => (e.type === 'ShotFired' ? [e.y] : []));
    expect(ys.length).toBeGreaterThanOrEqual(3);
    ys.forEach((y, i) => expect(Math.sign(y)).toBe(i % 2 === 0 ? 1 : -1));
  });

  it('keeps spread within the configured angle and is deterministic per seed', () => {
    const angles = (seed: number): number[] => {
      const c = setup({ spread: 0.6 });
      c.rng = createRng(seed);
      for (let i = 0; i < 120; i++) fire(c);
      return c.events.events.flatMap((e) => (e.type === 'ShotFired' ? [e.angle] : []));
    };
    const a = angles(1);
    expect(a.every((x) => Math.abs(x) <= 0.6 * DEG + 1e-9)).toBe(true);
    expect(new Set(a).size).toBeGreaterThan(1);
    expect(angles(1)).toEqual(a);
    expect(angles(2)).not.toEqual(a);
  });

  it('never exceeds the pool cap and drops shots without events when full', () => {
    const c = setup({ bulletCap: 3, bulletLife: 2 });
    for (let i = 0; i < 120; i++) fire(c);
    expect(c.bullets.count).toBe(3);
    expect(c.events.events.filter((e) => e.type === 'ShotFired')).toHaveLength(3);
  });
});

describe('stepBullets', () => {
  it('expires bullets after bulletLife', () => {
    const c = setup({ bulletLife: 0.5 });
    fire(c);
    for (let i = 0; i < 29; i++) stepBullets(c.bullets, [], c.cfg, c.events, DT);
    expect(c.bullets.count).toBe(1);
    for (let i = 0; i < 3; i++) stepBullets(c.bullets, [], c.cfg, c.events, DT);
    expect(c.bullets.count).toBe(0);
  });

  it('moves bullets by velocity * dt', () => {
    const c = setup({ spread: 0 });
    fire(c);
    const x0 = c.bullets.data.x[0]!;
    stepBullets(c.bullets, [], c.cfg, c.events, DT);
    expect(c.bullets.data.x[0]! - x0).toBeCloseTo(c.bullets.data.vx[0]! * DT, 4);
  });

  it('hits a target in the path: Hit event with direction and impulse, bullet consumed, hp reduced', () => {
    const c = setup({ spread: 0 });
    const target: Collider = { x: 400, y: 0, radius: 30, hp: 3, alive: true };
    fire(c);
    c.events.clear();
    for (let i = 0; i < 30 && c.bullets.count > 0; i++) {
      stepBullets(c.bullets, [target], c.cfg, c.events, DT);
    }
    expect(target.hp).toBe(2);
    expect(c.bullets.count).toBe(0);
    const hit = c.events.events.find((e) => e.type === 'Hit');
    expect(hit).toBeDefined();
    if (hit?.type === 'Hit') {
      expect(hit.dirX).toBeCloseTo(1, 3);
      expect(hit.impulse).toBe(c.cfg.hitImpulse);
    }
  });

  it('misses targets off the line and ignores dead ones', () => {
    const c = setup({ spread: 0 });
    const off: Collider = { x: 400, y: 200, radius: 30, hp: 3, alive: true };
    const dead: Collider = { x: 400, y: 0, radius: 30, hp: 3, alive: false };
    fire(c);
    for (let i = 0; i < 60; i++) stepBullets(c.bullets, [off, dead], c.cfg, c.events, DT);
    expect([off.hp, dead.hp]).toEqual([3, 3]);
    expect(c.events.events.some((e) => e.type === 'Hit')).toBe(false);
  });
});
