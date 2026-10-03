import { expect, it } from 'vitest';
import { createFixedLoop, STEP_SECONDS } from '../../src/app/loop';

it('120 s of irregular frames yields the expected step count and finite time', () => {
  let steps = 0;
  let simTime = 0;
  const loop = createFixedLoop((dt) => {
    steps++;
    simTime += dt;
  });
  // Deterministic jittery frame times averaging 1/60 s (no Math.random).
  const frameTimes = [1 / 50, 1 / 75, 1 / 60, 1 / 55, 1 / 66];
  let wall = 0;
  for (let i = 0; wall < 120; i++) {
    const dt = frameTimes[i % frameTimes.length]!;
    wall += dt;
    loop.advance(dt);
  }
  expect(Number.isFinite(simTime)).toBe(true);
  expect(Math.abs(steps * STEP_SECONDS - wall)).toBeLessThan(0.1);
});
