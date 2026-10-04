import { describe, expect, it } from 'vitest';
import { vectorEnd, velocityLength } from './vectors';

describe('velocityLength', () => {
  it('grows with speed, equal to the base length at max speed', () => {
    expect(velocityLength(0, 500, 100)).toBe(0);
    expect(velocityLength(250, 500, 100)).toBe(50);
    expect(velocityLength(500, 500, 100)).toBe(100);
    expect(velocityLength(300, 500, 100)).toBeGreaterThan(velocityLength(200, 500, 100));
  });

  it('is never negative', () => {
    expect(velocityLength(-50, 500, 100)).toBe(0);
  });

  it('a smaller base gives a proportionally smaller vector at the same speed', () => {
    expect(velocityLength(400, 500, 60)).toBeCloseTo(velocityLength(400, 500, 120) / 2);
  });
});

describe('vectorEnd', () => {
  const out = { x: 0, y: 0 };

  it('flips world y (up) to screen y (down) and normalizes the direction', () => {
    vectorEnd(out, 100, 100, 0, 5, 40);
    expect(out).toEqual({ x: 100, y: 60 });
    vectorEnd(out, 100, 100, 3, 4, 10);
    expect(out.x).toBeCloseTo(106);
    expect(out.y).toBeCloseTo(92);
  });

  it('gives the start point for a zero direction or zero length', () => {
    vectorEnd(out, 7, 9, 0, 0, 50);
    expect(out).toEqual({ x: 7, y: 9 });
    vectorEnd(out, 7, 9, 1, 0, 0);
    expect(out).toEqual({ x: 7, y: 9 });
  });
});
