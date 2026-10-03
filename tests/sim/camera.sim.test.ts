import { expect, it } from 'vitest';
import { createTuning } from '../../data/tuning';
import { viewSize } from '../../src/core/camera/view';
import { createRng } from '../../src/core/rng/rng';
import { createWorld, stepWorld } from '../../src/core/world/world';

it('120 s of random flight: camera finite, ship always inside the safe frame', () => {
  const tuning = createTuning();
  tuning.camera.shakeEnabled = true;
  const world = createWorld(11, tuning);
  const rng = createRng(99);
  const a = world.actions;
  const margin = 1 - 2 * tuning.camera.safeFrame;
  for (let i = 0; i < 120 * 60; i++) {
    if (i % 20 === 0) {
      a.steerX = rng.range(-1, 1);
      a.steerY = rng.range(-1, 1);
      a.rotate = rng.int(3) - 1;
      a.throttle = rng.range(-1, 1);
    }
    stepWorld(world, 1 / 60);
    const { camera: c, ship: s } = world;
    expect(Number.isFinite(c.x + c.y + c.view + c.shakeX + c.shakeY)).toBe(true);
    const size = viewSize(c.view, c.aspect);
    expect(Math.abs(s.x - c.x)).toBeLessThanOrEqual((size.width / 2) * margin + 1e-6);
    expect(Math.abs(s.y - c.y)).toBeLessThanOrEqual((size.height / 2) * margin + 1e-6);
    expect(c.view).toBeGreaterThanOrEqual(tuning.camera.viewMin - 1e-6);
    expect(c.view).toBeLessThanOrEqual(tuning.camera.viewMax + 1e-6);
  }
});
