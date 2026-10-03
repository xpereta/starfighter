import { expect, it } from 'vitest';
import { createTuning } from '../../data/tuning';
import { createRng } from '../../src/core/rng/rng';
import { createWorld, stepWorld } from '../../src/core/world/world';

it('120 s of random flight and fire: pool within cap, no NaN, hits registered', () => {
  const tuning = createTuning();
  tuning.arena.staticCount = 60;
  const world = createWorld(31, tuning);
  const rng = createRng(77);
  const a = world.actions;
  // Make the arena's own targets unkillable so the ship keeps crossing live ones.
  for (const t of world.targets) t.hp = t.maxHp = 1e9;
  let hits = 0;
  for (let i = 0; i < 120 * 60; i++) {
    if (i % 25 === 0) {
      a.steerX = rng.range(-1, 1);
      a.steerY = rng.range(-1, 1);
      a.throttle = rng.range(-1, 1);
      a.fire = rng.next() < 0.7;
    }
    stepWorld(world, 1 / 60);
    hits += world.events.events.filter((e) => e.type === 'Hit').length;
    const b = world.bullets;
    expect(b.count).toBeLessThanOrEqual(b.capacity);
    for (let j = 0; j < b.count; j++) {
      expect(Number.isFinite(b.data.x[j]! + b.data.y[j]! + b.data.life[j]!)).toBe(true);
    }
  }
  expect(hits).toBeGreaterThan(0);
});
