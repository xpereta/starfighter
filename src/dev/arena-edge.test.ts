import { describe, expect, it } from 'vitest';
import { arenaCircle, distanceToEdge, nearestEdgePoint } from './arena-edge';

const view = { width: 1600, height: 1000 };
const screen = { width: 1280, height: 800 }; // 0.8 px per world unit

describe('arenaCircle', () => {
  const out = { x: 0, y: 0, radius: 0 };

  it('is centered on the screen when the camera is at the arena center, with the radius in px', () => {
    arenaCircle(out, 6000, { x: 0, y: 0 }, view, screen);
    expect(out.x).toBeCloseTo(640);
    expect(out.y).toBeCloseTo(400);
    expect(out.radius).toBeCloseTo(4800);
  });

  it('moves the opposite way to the camera (world y is up, screen y is down)', () => {
    arenaCircle(out, 6000, { x: 1000, y: 500 }, view, screen);
    expect(out.x).toBeCloseTo(640 - 800);
    expect(out.y).toBeCloseTo(400 + 400);
  });

  it('shrinks as the view zooms out', () => {
    const near = arenaCircle({ x: 0, y: 0, radius: 0 }, 6000, { x: 0, y: 0 }, view, screen).radius;
    const far = arenaCircle(
      { x: 0, y: 0, radius: 0 },
      6000,
      { x: 0, y: 0 },
      { width: 3200, height: 2000 },
      screen,
    ).radius;
    expect(far).toBeCloseTo(near / 2);
  });
});

describe('distanceToEdge', () => {
  it('is positive inside, zero on the edge, negative outside', () => {
    expect(distanceToEdge(0, 0, 6000)).toBe(6000);
    expect(distanceToEdge(3000, 4000, 6000)).toBe(1000);
    expect(distanceToEdge(6000, 0, 6000)).toBe(0);
    expect(distanceToEdge(0, -6500, 6000)).toBe(-500);
  });
});

describe('nearestEdgePoint', () => {
  const p = { x: 0, y: 0 };
  it('lies on the edge in the direction of the point', () => {
    nearestEdgePoint(p, { x: 30, y: 40 }, 1000);
    expect(p.x).toBeCloseTo(600);
    expect(p.y).toBeCloseTo(800);
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(1000);
  });

  it('uses straight up when the point is at the arena center', () => {
    nearestEdgePoint(p, { x: 0, y: 0 }, 1000);
    expect([p.x, p.y]).toEqual([0, 1000]);
  });
});
