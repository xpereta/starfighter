import { describe, expect, it } from 'vitest';
import { createFlightConfig, type FlightConfig } from '../../../data/tuning/flight';
import { createEventQueue, type EventQueue } from '../events/events';
import { DEG, wrapAngle } from '../math';
import { createActions, type Actions } from '../world/actions';
import { createShip, stepFlight, turnRateLimit, type Ship } from './flight';

const DT = 1 / 60;
const cfgWith = (over: Partial<FlightConfig> = {}): FlightConfig => ({
  ...createFlightConfig(),
  ...over,
});
const actions = (over: Partial<Actions> = {}): Actions => ({ ...createActions(), ...over });
function run(
  ship: Ship,
  a: Actions,
  cfg: FlightConfig,
  seconds: number,
  events: EventQueue = createEventQueue(),
): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) stepFlight(ship, a, cfg, events, DT);
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
      stepFlight(ship, actions({ steerX: -1 }), cfg, createEventQueue(), DT);
      expect(Math.abs(ship.omega)).toBeLessThanOrEqual(turnRateLimit(cfg, ship.speed) + 1e-9);
    }
  });

  it('ramps angular velocity (inertia) instead of jumping', () => {
    const cfg = cfgWith({ steering: 'rotate' });
    const ship = createShip(cfg);
    stepFlight(ship, actions({ steerX: 1 }), cfg, createEventQueue(), DT);
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

describe('evade', () => {
  const evadeFor = (cfg: FlightConfig, a: Partial<Actions>, seconds: number) => {
    const ship = createShip(cfg);
    const events = createEventQueue();
    run(ship, actions({ evade: true, ...a }), cfg, seconds, events);
    return { ship, events };
  };

  it('starts once on press, emits EvadeStarted, defaults to the left side', () => {
    const cfg = cfgWith();
    const { ship, events } = evadeFor(cfg, {}, 0.1);
    const started = events.events.filter((e) => e.type === 'EvadeStarted');
    expect(started).toHaveLength(1);
    expect(ship.evadeSide).toBe(1);
    expect(ship.evadeTimer).toBeGreaterThan(0);
  });

  it('picks the side from the rotate input and from the stick relative to the nose (point steering)', () => {
    const cfg = cfgWith({ steering: 'point' });
    expect(evadeFor(cfg, { rotate: 1 }, 0.05).ship.evadeSide).toBe(-1); // turning right: dodge right
    expect(evadeFor(cfg, { rotate: -1 }, 0.05).ship.evadeSide).toBe(1);
    // Nose along +x (left is +y): stick down is to the right of the nose.
    expect(evadeFor(cfg, { steerY: -1 }, 0.05).ship.evadeSide).toBe(-1);
    expect(evadeFor(cfg, { steerY: 1 }, 0.05).ship.evadeSide).toBe(1);
    // A tiny stick deflection is ignored (default left).
    expect(evadeFor(cfg, { steerY: -0.1 }, 0.05).ship.evadeSide).toBe(1);
  });

  it('is invulnerable for evadeIFrames, evades for evadeTime, then stops', () => {
    const cfg = cfgWith();
    const ship = createShip(cfg);
    const a = actions({ evade: true });
    const q = createEventQueue();
    stepFlight(ship, a, cfg, q, DT);
    expect(ship.invulnerable).toBe(true);
    run(ship, a, cfg, cfg.evadeIFrames - 2 * DT, q);
    expect(ship.invulnerable).toBe(true);
    run(ship, a, cfg, 4 * DT, q);
    expect(ship.invulnerable).toBe(false);
    expect(ship.evadeTimer).toBeGreaterThan(0); // still rolling after the i-frames
    run(ship, a, cfg, cfg.evadeTime, q);
    expect(ship.evadeTimer).toBe(0);
    expect(ship.roll).toBe(0);
  });

  it('enforces the cooldown and needs a fresh press (holding does not retrigger)', () => {
    const cfg = cfgWith();
    const ship = createShip(cfg);
    const q = createEventQueue();
    const count = () => q.events.filter((e) => e.type === 'EvadeStarted').length;
    run(ship, actions({ evade: true }), cfg, cfg.evadeCooldown + 1, q); // held the whole time
    expect(count()).toBe(1);
    run(ship, actions({ evade: false }), cfg, DT, q); // release
    run(ship, actions({ evade: true }), cfg, DT, q);
    expect(count()).toBe(2);
    // A press inside the cooldown does nothing.
    run(ship, actions({ evade: false }), cfg, 0.6, q);
    run(ship, actions({ evade: true }), cfg, DT, q);
    expect(count()).toBe(2);
    // After the cooldown a new press works.
    run(ship, actions({ evade: false }), cfg, cfg.evadeCooldown, q);
    run(ship, actions({ evade: true }), cfg, DT, q);
    expect(count()).toBe(3);
  });

  it('with rotate steering (the default) the side follows the stick X, and a stick Y alone gives the default left', () => {
    const cfg = cfgWith({ steering: 'rotate' });
    expect(cfg.steering).toBe(createFlightConfig().steering);
    expect(evadeFor(cfg, { steerX: 1 }, 0.05).ship.evadeSide).toBe(-1); // stick right: dodge right
    expect(evadeFor(cfg, { steerX: -1 }, 0.05).ship.evadeSide).toBe(1);
    expect(evadeFor(cfg, { steerY: -1 }, 0.05).ship.evadeSide).toBe(1); // up/down means nothing here
  });

  it('rotate steering is the default', () => {
    expect(createFlightConfig().steering).toBe('rotate');
  });

  it('sidesteps by evadeOffset toward the chosen side and adds a speed bonus', () => {
    const cfg = cfgWith({ steering: 'point' });
    const base = createShip(cfg);
    run(base, actions(), cfg, cfg.evadeTime);
    const left = evadeFor(cfg, {}, cfg.evadeTime).ship;
    expect(left.y - base.y).toBeCloseTo(cfg.evadeOffset, 0);
    expect(evadeFor(cfg, { steerY: -1 }, cfg.evadeTime).ship.evadeSide).toBe(-1);
    // Forward progress is about 15% further during the evade.
    expect(left.x / base.x).toBeGreaterThan(1.1);
  });

  it('variant without sidestep: no lateral slide, but a tighter break turn', () => {
    const cfg = cfgWith({ evadeSidestep: false, steering: 'rotate' });
    const normal = createShip(cfg);
    run(normal, actions({ steerX: 1 }), cfg, 0.4);
    const evading = createShip(cfg);
    run(evading, actions({ steerX: 1, evade: true }), cfg, 0.4);
    expect(Math.abs(evading.heading)).toBeGreaterThan(Math.abs(normal.heading));
    const straight = evadeFor(cfgWith({ evadeSidestep: false }), {}, cfg.evadeTime).ship;
    expect(Math.abs(straight.y)).toBeLessThan(1);
  });
});
