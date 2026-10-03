import { describe, expect, it } from 'vitest';
import { createFlightConfig } from '../../../data/tuning/flight';
import { createHudConfig } from '../../../data/tuning/hud';
import {
  blinkOn,
  createEdgeIndicator,
  distanceStyle,
  edgeIndicator,
  evadeReadiness,
  speedBar,
  throttleState,
} from './layout';

const view = { width: 1600, height: 1000 };
const screen = { width: 1280, height: 800 }; // 0.8 px per world unit
const cam = { x: 0, y: 0 };
const margin = 30;
const place = (x: number, y: number, radius = 10) => {
  const out = createEdgeIndicator();
  const offscreen = edgeIndicator(out, { x, y, radius }, cam, view, screen, margin);
  return { out, offscreen };
};

describe('edgeIndicator', () => {
  it('returns false for targets on screen, including partly visible ones', () => {
    expect(place(0, 0).offscreen).toBe(false);
    expect(place(700, 400).offscreen).toBe(false);
    // Center is 20 u past the right edge (800), but its 60 u radius still overlaps the screen.
    expect(place(820, 0, 60).offscreen).toBe(false);
    expect(place(820, 0, 10).offscreen).toBe(true);
  });

  it('puts an arrow on the right border pointing right', () => {
    const { out, offscreen } = place(3000, 0);
    expect(offscreen).toBe(true);
    expect(out.x).toBeCloseTo(screen.width - margin);
    expect(out.y).toBeCloseTo(screen.height / 2);
    expect(out.angle).toBeCloseTo(0);
    expect(out.distance).toBeCloseTo(3000);
  });

  it('flips world y to screen y: a target above points up (canvas -PI/2) at the top border', () => {
    const { out } = place(0, 4000);
    expect(out.y).toBeCloseTo(margin);
    expect(out.x).toBeCloseTo(screen.width / 2);
    expect(out.angle).toBeCloseTo(-Math.PI / 2);
  });

  it('keeps every arrow on the inset border, in the right direction, for any bearing', () => {
    for (let a = 0; a < Math.PI * 2; a += 0.17) {
      const { out, offscreen } = place(Math.cos(a) * 5000, Math.sin(a) * 5000);
      expect(offscreen).toBe(true);
      expect(out.x).toBeGreaterThanOrEqual(margin - 1e-6);
      expect(out.x).toBeLessThanOrEqual(screen.width - margin + 1e-6);
      expect(out.y).toBeGreaterThanOrEqual(margin - 1e-6);
      expect(out.y).toBeLessThanOrEqual(screen.height - margin + 1e-6);
      const onBorder =
        Math.abs(out.x - margin) < 1e-6 ||
        Math.abs(out.x - (screen.width - margin)) < 1e-6 ||
        Math.abs(out.y - margin) < 1e-6 ||
        Math.abs(out.y - (screen.height - margin)) < 1e-6;
      expect(onBorder).toBe(true);
      // Direction from the screen center to the arrow matches the arrow angle.
      const toArrow = Math.atan2(out.y - screen.height / 2, out.x - screen.width / 2);
      expect(Math.cos(toArrow - out.angle)).toBeCloseTo(1, 5);
    }
  });

  it('follows the camera center, not the world origin', () => {
    const out = createEdgeIndicator();
    const hidden = edgeIndicator(
      out,
      { x: 5000, y: 0, radius: 10 },
      { x: 5000, y: 0 },
      view,
      screen,
      margin,
    );
    expect(hidden).toBe(false);
  });
});

describe('distanceStyle', () => {
  const cfg = createHudConfig();
  it('grows and brightens as targets get closer, within configured bounds', () => {
    const far = distanceStyle(cfg.edgeRange * 2, cfg);
    const mid = distanceStyle(cfg.edgeRange / 2, cfg);
    const near = distanceStyle(0, cfg);
    expect(far).toEqual({ size: cfg.edgeSizeMin, opacity: cfg.edgeOpacityMin });
    expect(near).toEqual({ size: cfg.edgeSizeMax, opacity: 1 });
    expect(mid.size).toBeGreaterThan(far.size);
    expect(mid.size).toBeLessThan(near.size);
    expect(mid.opacity).toBeGreaterThan(far.opacity);
    expect(mid.opacity).toBeLessThan(near.opacity);
  });
});

describe('speedBar', () => {
  const f = createFlightConfig();
  it('maps min..max speed to 0..1 with the corner and cruise markers between', () => {
    expect(speedBar(f.minSpeed, f).fill).toBe(0);
    expect(speedBar(f.maxSpeed, f).fill).toBe(1);
    expect(speedBar(9999, f).fill).toBe(1);
    const bar = speedBar(f.cruiseSpeed, f);
    expect(bar.fill).toBeCloseTo(bar.cruise);
    expect(bar.corner).toBeGreaterThan(0);
    expect(bar.corner).toBeLessThan(bar.cruise);
    expect(bar.cruise).toBeLessThan(1);
  });
});

describe('small helpers', () => {
  it('evade readiness goes from 0 to 1 over the cooldown', () => {
    expect(evadeReadiness(2, 2)).toBe(0);
    expect(evadeReadiness(1, 2)).toBe(0.5);
    expect(evadeReadiness(0, 2)).toBe(1);
  });

  it('throttle state respects the deadband', () => {
    expect(throttleState(0.04, 0.05)).toBe('CRUISE');
    expect(throttleState(0.5, 0.05)).toBe('BOOST');
    expect(throttleState(-0.5, 0.05)).toBe('BRAKE');
  });

  it('blink alternates at the configured rate', () => {
    expect(blinkOn(0, 3)).toBe(true);
    expect(blinkOn(1 / 6 + 0.01, 3)).toBe(false);
    expect(blinkOn(1 / 3 + 0.01, 3)).toBe(true);
  });
});
