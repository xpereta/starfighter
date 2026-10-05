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

describe('createFixedLoop pause', () => {
  it('does not step while paused and has no catch-up burst on resume', () => {
    let steps = 0;
    const loop = createFixedLoop(() => steps++);
    loop.advance(STEP_SECONDS * 2);
    expect(steps).toBe(2);
    loop.setPaused(true);
    for (let i = 0; i < 100; i++) loop.advance(1);
    expect(steps).toBe(2);
    loop.setPaused(false);
    loop.advance(STEP_SECONDS); // the first frame after resume is a normal frame
    expect(steps).toBe(3);
  });
});
