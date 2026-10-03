import { expect, it } from 'vitest';
import { createPool } from '../../src/core/world/pool';
import { createWorld, stepWorld } from '../../src/core/world/world';

it('120 s of steps keeps time finite and pools within their cap', () => {
  const world = createWorld(2026);
  const dt = 1 / 60;
  const pool = createPool(50, ['x', 'life']);
  for (let i = 0; i < 120 * 60; i++) {
    stepWorld(world, dt);
    // Stress: spawn more than the cap allows, expire randomly.
    for (let k = 0; k < 3; k++) {
      const s = pool.spawn();
      if (s >= 0) pool.data.life[s] = world.rng.range(0.1, 1);
    }
    for (let j = pool.count - 1; j >= 0; j--) {
      pool.data.life[j]! -= dt;
      if (pool.data.life[j]! <= 0) pool.remove(j);
    }
    expect(pool.count).toBeLessThanOrEqual(pool.capacity);
  }
  expect(world.tick).toBe(7200);
  expect(Number.isFinite(world.time)).toBe(true);
  expect(world.time).toBeCloseTo(120, 3);
});
