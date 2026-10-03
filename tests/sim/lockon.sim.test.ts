import { expect, it } from 'vitest';
import { createTuning } from '../../data/tuning';
import { lockLimit } from '../../src/core/lockon/lockon';
import { createRng } from '../../src/core/rng/rng';
import { FIGHTER_ID_BASE, getLockable } from '../../src/core/world/lockable';
import { createWorld, stepWorld } from '../../src/core/world/world';

const DT = 1 / 60;

it('120 s of random flight with fighters and wingmen: locks are valid, unique, within the limit and progress stays in range', () => {
  const tuning = createTuning();
  tuning.arena.staticCount = 40; // plenty to lock
  const world = createWorld(8, tuning);
  const rng = createRng(2024);
  const a = world.actions;
  // The world provides 2 wingmen by default (prototype 2 track B).
  // Waves of real enemy fighters spawn by themselves (prototype 2 track B).

  let acquired = 0;
  for (let i = 0; i < 120 * 60; i++) {
    if (i % 25 === 0) {
      a.steerX = rng.range(-1, 1);
      a.steerY = rng.range(-1, 1);
      a.throttle = rng.range(-1, 1);
    }
    // Fighters come and go, so locks also end by death and stale ids.
    if (i % 200 === 0 && world.fighters.length > 0) {
      const f = world.fighters[rng.int(world.fighters.length)]!;
      f.alive = !f.alive;
    }
    stepWorld(world, DT);

    const { lockon } = world;
    for (const e of world.events.events) if (e.type === 'LockAcquired') acquired++;
    expect(Number.isFinite(lockon.progress + lockon.acquiringGrace)).toBe(true);
    expect(lockon.progress).toBeGreaterThanOrEqual(0);
    expect(lockon.progress).toBeLessThanOrEqual(tuning.lockon.lockTime + 1e-9);
    expect(lockon.locks.length).toBeLessThanOrEqual(lockLimit(world));
    expect(lockon.graces).toHaveLength(lockon.locks.length);
    expect(new Set(lockon.locks).size).toBe(lockon.locks.length);
    for (const id of lockon.locks) {
      const body = getLockable(world, id);
      expect(body?.alive, `lock ${id} refers to a living lockable`).toBe(true);
      expect(id === lockon.acquiringId).toBe(false);
    }
    if (lockon.acquiringId >= FIGHTER_ID_BASE) {
      expect(world.fighters[lockon.acquiringId - FIGHTER_ID_BASE]).toBeDefined();
    }
  }
  expect(acquired).toBeGreaterThan(0);
});
