import { describe, expect, it } from 'vitest';
import { bracketArm, bracketHalf } from './order-marker';

describe('order marker geometry', () => {
  it('keeps a minimum size so small targets still get readable brackets', () => {
    expect(bracketHalf(2)).toBeGreaterThanOrEqual(16);
    expect(bracketHalf(0)).toBeGreaterThanOrEqual(16);
  });

  it('grows with the target and always sits outside the ring', () => {
    expect(bracketHalf(60)).toBeGreaterThan(bracketHalf(30));
    for (const r of [5, 20, 40, 80]) expect(bracketHalf(r)).toBeGreaterThan(r);
  });

  it('corner arms are a part of the half-size, so the four corners never meet', () => {
    for (const half of [16, 40, 100]) {
      expect(bracketArm(half)).toBeGreaterThan(0);
      expect(bracketArm(half)).toBeLessThan(half);
    }
  });
});
