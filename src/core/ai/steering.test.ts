import { describe, expect, it } from 'vitest';
import { createFighterConfig } from '../../../data/tuning/fighter';
import { createFlightConfig } from '../../../data/tuning/flight';
import { deriveFlight, leadPoint } from './steering';

describe('deriveFlight', () => {
  const flight = createFlightConfig();
  const cfg = createFighterConfig();

  it('scales the player flight model: slower turns and top speed, point steering', () => {
    const d = deriveFlight(createFlightConfig(), flight, cfg);
    expect(d.maxTurnRate).toBeCloseTo(flight.maxTurnRate * cfg.turnRateScale);
    expect(d.turnRateAtMin).toBeCloseTo(flight.turnRateAtMin * cfg.turnRateScale);
    expect(d.turnRateAtMax).toBeCloseTo(flight.turnRateAtMax * cfg.turnRateScale);
    expect(d.maxSpeed).toBeCloseTo(flight.maxSpeed * cfg.speedScale);
    expect(d.maxSpeed).toBeLessThan(flight.maxSpeed);
    expect(d.steering).toBe('point');
    // Everything else is the player's.
    expect(d.accel).toBe(flight.accel);
    expect(d.grip).toBe(flight.grip);
  });

  it('keeps speeds ordered even with extreme scales, and never touches the player config', () => {
    const before = { ...flight };
    const d = deriveFlight(createFlightConfig(), flight, { ...cfg, speedScale: 0.5 });
    expect(d.cruiseSpeed).toBeGreaterThanOrEqual(d.minSpeed);
    expect(d.cruiseSpeed).toBeLessThanOrEqual(d.maxSpeed);
    expect(d.cornerSpeed).toBeLessThanOrEqual(d.maxSpeed);
    expect(flight).toEqual(before);
  });

  it('fills the given object in place (no allocation) and returns it', () => {
    const out = createFlightConfig();
    expect(deriveFlight(out, flight, cfg)).toBe(out);
  });
});

describe('leadPoint', () => {
  const out = { x: 0, y: 0 };
  const still = { x: 0, y: 0, vx: 0, vy: 0 };

  it('aims straight at a target that is not moving relative to the shooter', () => {
    leadPoint(out, still, { x: 600, y: 0, vx: 0, vy: 0 }, 600, 2);
    expect(out).toEqual({ x: 600, y: 0 });
  });

  it('leads a crossing target by its velocity times the bullet flight time', () => {
    // 600 u away, bullet 600 u/s: 1 s of flight; the target moves 100 u/s sideways.
    leadPoint(out, still, { x: 600, y: 0, vx: 0, vy: 100 }, 600, 2);
    expect(out.x).toBeCloseTo(600);
    expect(out.y).toBeCloseTo(100);
  });

  it('uses the velocity relative to the shooter', () => {
    leadPoint(out, { x: 0, y: 0, vx: 0, vy: 100 }, { x: 600, y: 0, vx: 0, vy: 100 }, 600, 2);
    expect(out.y).toBeCloseTo(0); // both move the same way: no lead needed
  });

  it('caps the lead time', () => {
    leadPoint(out, still, { x: 6000, y: 0, vx: 0, vy: 100 }, 600, 1.5);
    expect(out.y).toBeCloseTo(150);
  });

  it('with zero max lead aims at the target position', () => {
    leadPoint(out, still, { x: 600, y: 0, vx: 0, vy: 100 }, 600, 0);
    expect(out).toEqual({ x: 600, y: 0 });
  });
});
