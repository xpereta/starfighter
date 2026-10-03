import { expect, it } from 'vitest';
import { createTuning } from '../../data/tuning';
import { createRng } from '../../src/core/rng/rng';
import { createWorld, stepWorld } from '../../src/core/world/world';

it('120 s of random inputs: no NaN, speed in range, ship stays near the arena', () => {
  for (const steering of ['point', 'rotate'] as const) {
    const tuning = createTuning();
    tuning.flight.steering = steering;
    const cfg = tuning.flight;
    const world = createWorld(7, tuning);
    const inputRng = createRng(1234);
    const a = world.actions;
    let furthest = 0;
    for (let i = 0; i < 120 * 60; i++) {
      // Hold random inputs for ~0.5 s at a time.
      if (i % 30 === 0) {
        a.steerX = inputRng.range(-1, 1);
        a.steerY = inputRng.range(-1, 1);
        a.rotate = inputRng.int(3) - 1;
        a.throttle = inputRng.range(-1, 1);
        a.evade = inputRng.next() < 0.3;
      }
      stepWorld(world, 1 / 60);
      const s = world.ship;
      expect(Number.isFinite(s.x + s.y + s.heading + s.omega + s.speed)).toBe(true);
      expect(s.speed).toBeGreaterThanOrEqual(cfg.minSpeed);
      expect(s.speed).toBeLessThanOrEqual(cfg.maxSpeed);
      furthest = Math.max(furthest, Math.hypot(s.x, s.y));
    }
    expect(furthest).toBeLessThan(cfg.arenaRadius + 1000);
  }
});
