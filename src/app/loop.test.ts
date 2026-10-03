import { describe, expect, it } from 'vitest';
import { createFixedLoop, STEP_SECONDS } from './loop';

describe('createFixedLoop', () => {
  it('runs one step per 1/60 s', () => {
    let steps = 0;
    const loop = createFixedLoop(() => steps++);
    loop.advance(STEP_SECONDS * 3 + 0.001);
    expect(steps).toBe(3);
  });

  it('carries the remainder between frames', () => {
    let steps = 0;
    const loop = createFixedLoop(() => steps++);
    loop.advance(STEP_SECONDS * 0.6);
    expect(steps).toBe(0);
    loop.advance(STEP_SECONDS * 0.6);
    expect(steps).toBe(1);
  });

  it('caps catch-up steps after a long stall', () => {
    let steps = 0;
    const loop = createFixedLoop(() => steps++);
    loop.advance(10);
    expect(steps).toBe(5);
    expect(loop.advance(0)).toBe(0);
  });
});
