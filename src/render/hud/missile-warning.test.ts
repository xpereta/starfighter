import { describe, expect, it } from 'vitest';
import { ARROW_RING, markerPulse, warningArrow } from './missile-warning';

describe('warningArrow', () => {
  const out = { x: 0, y: 0, angle: 0 };
  it('sits on the ring around the ship, toward the missile, with the screen y flipped', () => {
    // A missile due east of the ship (world angle 0): the arrow is to the right, pointing right.
    warningArrow(out, 100, 200, 0);
    expect(out.x).toBeCloseTo(100 + ARROW_RING);
    expect(out.y).toBeCloseTo(200);
    expect(out.angle).toBeCloseTo(0);
    // Due north in the world (up on the screen, y smaller).
    warningArrow(out, 100, 200, Math.PI / 2);
    expect(out.x).toBeCloseTo(100);
    expect(out.y).toBeCloseTo(200 - ARROW_RING);
    expect(out.angle).toBeCloseTo(-Math.PI / 2);
  });
  it('honours a custom ring and returns its argument', () => {
    expect(warningArrow(out, 0, 0, Math.PI, 10)).toBe(out);
    expect(out.x).toBeCloseTo(-10);
  });
});

describe('markerPulse', () => {
  it('stays in 0..1 and throbs faster the closer the impact', () => {
    const crossings = (eta: number): number => {
      let n = 0;
      let last = markerPulse(0, eta) > 0.5;
      for (let t = 0; t < 2; t += 0.005) {
        const on = markerPulse(t, eta) > 0.5;
        if (on !== last) n++;
        last = on;
        expect(markerPulse(t, eta)).toBeGreaterThanOrEqual(0);
        expect(markerPulse(t, eta)).toBeLessThanOrEqual(1);
      }
      return n;
    };
    expect(crossings(0.2)).toBeGreaterThan(crossings(3));
    expect(crossings(Infinity)).toBeGreaterThan(0);
  });
});
