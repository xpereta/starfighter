import { expect, it } from 'vitest';
import { clamp, lerp, TAU, wrapAngle } from './math';

it('clamp and lerp', () => {
  expect(clamp(5, 0, 1)).toBe(1);
  expect(clamp(-5, 0, 1)).toBe(0);
  expect(lerp(10, 20, 0.25)).toBe(12.5);
});

it('wrapAngle maps into [-PI, PI]', () => {
  expect(wrapAngle(TAU + 0.5)).toBeCloseTo(0.5);
  expect(wrapAngle(-TAU - 0.5)).toBeCloseTo(-0.5);
  expect(wrapAngle(Math.PI * 1.5)).toBeCloseTo(-Math.PI / 2);
});
