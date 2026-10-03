import { expect, it } from 'vitest';
import { sampleCurve } from './curve';

const pts = [
  [100, 150],
  [200, 200],
  [400, 100],
] as const;

it('interpolates piecewise linearly and clamps outside', () => {
  expect(sampleCurve(pts, 100)).toBe(150);
  expect(sampleCurve(pts, 150)).toBe(175);
  expect(sampleCurve(pts, 200)).toBe(200);
  expect(sampleCurve(pts, 300)).toBe(150);
  expect(sampleCurve(pts, 50)).toBe(150);
  expect(sampleCurve(pts, 999)).toBe(100);
});

it('rejects an empty curve', () => {
  expect(() => sampleCurve([], 1)).toThrow();
});
