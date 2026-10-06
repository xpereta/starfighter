import { describe, expect, it } from 'vitest';
import { createTuning } from '../../../data/tuning';
import { createWorld } from '../world/world';
import { launchEnemyMissile } from './enemy-missiles';
import { createMissileWarning, missileWarning, warningText } from './enemy-missiles-warning';

function world() {
  const w = createWorld(1, createTuning());
  w.ship.x = 0;
  w.ship.y = 0;
  w.ship.vx = 0;
  w.ship.vy = 0;
  return w;
}

describe('missileWarning', () => {
  it('is inactive with no missiles', () => {
    const w = missileWarning(world(), createMissileWarning());
    expect(w.active).toBe(false);
    expect(w.count).toBe(0);
    expect(w.nearest).toBe(-1);
    expect(w.eta).toBe(Infinity);
    expect(w.sinceLaunch).toBe(Infinity);
  });

  it('points at the nearest missile with its distance and a time to impact', () => {
    const w = world();
    launchEnemyMissile(w, 0, 2000, -Math.PI / 2, 0); // far, straight above
    launchEnemyMissile(w, 800, 0, Math.PI, 0); // near, to the right, flying at the ship
    w.enemies.missiles.data.vx[1] = -400;
    const out = missileWarning(w, createMissileWarning());
    expect(out.active).toBe(true);
    expect(out.count).toBe(2);
    expect(out.nearest).toBe(1);
    expect(out.distance).toBeCloseTo(800);
    expect(out.angle).toBeCloseTo(0);
    expect(out.eta).toBeCloseTo(2);
  });

  it('reuses its object and reports the youngest launch', () => {
    const w = world();
    launchEnemyMissile(w, 800, 0, Math.PI, 0);
    w.enemies.missiles.data.phase[0] = 1.5;
    launchEnemyMissile(w, 0, 800, 0, 0);
    w.enemies.missiles.data.phase[1] = 0.25;
    const store = createMissileWarning();
    expect(missileWarning(w, store)).toBe(store);
    expect(store.sinceLaunch).toBeCloseTo(0.25);
  });

  it('does not change the world (read-only)', () => {
    const w = world();
    launchEnemyMissile(w, 800, 0, Math.PI, 0);
    const before = JSON.stringify([...w.enemies.missiles.data.x]);
    missileWarning(w, createMissileWarning());
    expect(JSON.stringify([...w.enemies.missiles.data.x])).toBe(before);
  });
});

describe('warningText', () => {
  it('says MISSILE or MISSILES n, with the time when it is closing', () => {
    expect(warningText({ count: 1, eta: 1.26 })).toBe('MISSILE  1.3s');
    expect(warningText({ count: 3, eta: 0.5 })).toBe('MISSILES 3  0.5s');
    expect(warningText({ count: 1, eta: Infinity })).toBe('MISSILE');
  });
});
