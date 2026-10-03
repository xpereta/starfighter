import { describe, expect, it } from 'vitest';
import { createFlightConfig, type FlightConfig } from '../../../data/tuning/flight';
import { DEG, wrapAngle } from '../math';
import { createActions, type Actions } from '../world/actions';
import { createShip, stepFlight, turnRateLimit, type Ship } from './flight';

const DT = 1 / 60;
const cfgWith = (over: Partial<FlightConfig> = {}): FlightConfig => ({
  ...createFlightConfig(),
  ...over,
});
const actions = (over: Partial<Actions> = {}): Actions => ({ ...createActions(), ...over });
function run(ship: Ship, a: Actions, cfg: FlightConfig, seconds: number): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) stepFlight(ship, a, cfg, DT);
}

describe('throttle and speed', () => {
  it('clamps speed to [min, max]', () => {
    const cfg = cfgWith();
    const ship = createShip(cfg);
    run(ship, actions({ throttle: 1 }), cfg, 10);
    expect(ship.speed).toBe(cfg.maxSpeed);
    run(ship, actions({ throttle: -1 }), cfg, 10);
    expect(ship.speed).toBe(cfg.minSpeed);
  });

  it('returns toward cruise with neutral throttle, from both sides', () => {
    const cfg = cfgWith();
    const ship = createShip(cfg);
    ship.speed = cfg.maxSpeed;
    run(ship, actions(), cfg, 1);
    expect(ship.speed).toBeCloseTo(cfg.maxSpeed - cfg.cruiseReturnRate, 1);
    ship.speed = cfg.minSpeed;
    run(ship, actions(), cfg, 30);
    expect(ship.speed).toBe(cfg.cruiseSpeed);
  });
});

describe('turn-rate curve', () => {
  it('peaks at corner speed and falls toward min/max speed', () => {
    const cfg = cfgWith();
    expect(turnRateLimit(cfg, cfg.cornerSpeed)).toBeCloseTo(cfg.maxTurnRate * DEG);
    expect(turnRateLimit(cfg, cfg.minSpeed)).toBeCloseTo(cfg.turnRateAtMin * DEG);
    expect(turnRateLimit(cfg, cfg.maxSpeed)).toBeCloseTo(cfg.turnRateAtMax * DEG);
    expect(turnRateLimit(cfg, cfg.cornerSpeed)).toBeGreaterThan(turnRateLimit(cfg, cfg.maxSpeed));
  });
});

describe('steering', () => {
  it('point-to-steer turns toward the stick direction and then holds it', () => {
    const cfg = cfgWith({ steering: 'point' });
    const ship = createShip(cfg);
    run(ship, actions({ steerY: 1 }), cfg, 3);
    expect(wrapAngle(ship.heading - Math.PI / 2)).toBeCloseTo(0, 1);
    run(ship, actions(), cfg, 1);
    expect(ship.heading).toBeCloseTo(Math.PI / 2, 1);
  });

  it('never exceeds the speed-dependent turn limit', () => {
    const cfg = cfgWith({ steering: 'point' });
    const ship = createShip(cfg);
    for (let i = 0; i < 120; i++) {
      stepFlight(ship, actions({ steerX: -1 }), cfg, DT);
      expect(Math.abs(ship.omega)).toBeLessThanOrEqual(turnRateLimit(cfg, ship.speed) + 1e-9);
    }
  });

  it('ramps angular velocity (inertia) instead of jumping', () => {
    const cfg = cfgWith({ steering: 'rotate' });
    const ship = createShip(cfg);
    stepFlight(ship, actions({ steerX: 1 }), cfg, DT);
    expect(Math.abs(ship.omega)).toBeCloseTo(cfg.turnAccel * DEG * DT);
    expect(Math.abs(ship.omega)).toBeLessThan(turnRateLimit(cfg, ship.speed));
  });

  it('rotate scheme: stick right turns clockwise (heading decreases)', () => {
    const cfg = cfgWith({ steering: 'rotate' });
    const ship = createShip(cfg);
    run(ship, actions({ steerX: 1 }), cfg, 0.5);
    expect(ship.heading).toBeLessThan(0);
    const left = createShip(cfg);
    run(left, actions({ steerX: -1 }), cfg, 0.5);
    expect(left.heading).toBeGreaterThan(0);
  });

  it('keyboard rotate works in the point scheme too', () => {
    const cfg = cfgWith({ steering: 'point' });
    const ship = createShip(cfg);
    run(ship, actions({ rotate: -1 }), cfg, 0.5);
    expect(ship.heading).toBeGreaterThan(0);
  });

  it('rotate scheme ignores a stick Y input', () => {
    const cfg = cfgWith({ steering: 'rotate' });
    const ship = createShip(cfg);
    run(ship, actions({ steerY: 1 }), cfg, 1);
    expect(ship.heading).toBe(0);
  });
});

describe('grip', () => {
  it('rotates the velocity toward the nose, faster with more grip', () => {
    const angleAfter = (grip: number): number => {
      const cfg = cfgWith({ grip, gripAtMaxSpeed: grip });
      const ship = createShip(cfg);
      ship.heading = Math.PI / 2;
      run(ship, actions(), cfg, 0.2);
      return Math.atan2(ship.vy, ship.vx);
    };
    expect(angleAfter(6)).toBeGreaterThan(0);
    expect(angleAfter(6)).toBeLessThan(Math.PI / 2);
    expect(angleAfter(12)).toBeGreaterThan(angleAfter(3));
  });

  it('keeps speed magnitude equal to ship.speed', () => {
    const cfg = cfgWith();
    const ship = createShip(cfg);
    ship.heading = 1;
    run(ship, actions({ throttle: 0.5 }), cfg, 1);
    expect(Math.hypot(ship.vx, ship.vy)).toBeCloseTo(ship.speed);
  });
});

describe('arena boundary', () => {
  it('sets the outside flag and turns the ship back toward the center', () => {
    const cfg = cfgWith({ arenaRadius: 1000 });
    const ship = createShip(cfg);
    ship.x = 1500;
    ship.heading = 0;
    ship.vx = ship.speed;
    run(ship, actions({ steerX: 1, steerY: 0 }), cfg, 0.1);
    expect(ship.outside).toBe(true);
    run(ship, actions(), cfg, 6);
    expect(Math.hypot(ship.x, ship.y)).toBeLessThan(1500);
  });
});
