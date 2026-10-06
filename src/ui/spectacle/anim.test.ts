import { describe, expect, it } from 'vitest';
import { easeInCubic, easeOutBack, easeOutCubic, slide } from './anim';

describe('easing', () => {
  it('starts at 0 and ends at 1', () => {
    for (const f of [easeOutCubic, easeInCubic, easeOutBack]) {
      expect(f(0)).toBeCloseTo(0);
      expect(f(1)).toBeCloseTo(1);
    }
  });

  it('easeOutBack overshoots, the cubics do not', () => {
    expect(easeOutBack(0.7)).toBeGreaterThan(1);
    expect(easeOutCubic(0.5)).toBeLessThan(1);
  });

  it('clamps outside 0..1', () => {
    expect(easeOutCubic(-3)).toBe(0);
    expect(easeInCubic(7)).toBe(1);
  });
});

describe('slide', () => {
  it('moves from off screen to in place, holds, and leaves', () => {
    expect(slide(-1, 1, 2, 1)).toMatchObject({ off: 1, alpha: 0 });
    expect(slide(0, 1, 2, 1).off).toBe(1);
    expect(slide(0.5, 1, 2, 1).off).toBeGreaterThan(0);
    expect(slide(0.5, 1, 2, 1).off).toBeLessThan(1);
    expect(slide(1.5, 1, 2, 1)).toMatchObject({ off: 0, alpha: 1, phase: 'hold' });
    expect(slide(3.5, 1, 2, 1).phase).toBe('out');
    expect(slide(5, 1, 2, 1)).toMatchObject({ off: 1, alpha: 0, phase: 'done' });
  });
});
