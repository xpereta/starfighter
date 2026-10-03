import { describe, expect, it } from 'vitest';
import { REFERENCE_ASPECT, viewSize } from './view';

describe('viewSize', () => {
  it('matches the requested width on the reference aspect', () => {
    const v = viewSize(1600, REFERENCE_ASPECT);
    expect(v.width).toBeCloseTo(1600);
    expect(v.height).toBeCloseTo(1000);
  });

  it('keeps the visible area constant on other aspects', () => {
    const ref = viewSize(1600, REFERENCE_ASPECT);
    for (const aspect of [1, 16 / 9, 21 / 9, 0.5]) {
      const v = viewSize(1600, aspect);
      expect(v.width * v.height).toBeCloseTo(ref.width * ref.height);
      expect(v.width / v.height).toBeCloseTo(aspect);
    }
  });
});
