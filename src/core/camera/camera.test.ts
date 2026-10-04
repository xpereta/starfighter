import { describe, expect, it } from 'vitest';
import { createCameraConfig, type CameraConfig } from '../../../data/tuning/camera';
import { createFlightConfig } from '../../../data/tuning/flight';
import type { GameEvent } from '../events/events';
import { createShip, type Ship } from '../flight/flight';
import { createCamera, stepCamera, type Camera } from './camera';
import { viewSize } from './view';

const DT = 1 / 60;
const flight = createFlightConfig();
const cfgWith = (over: Partial<CameraConfig> = {}): CameraConfig => ({
  ...createCameraConfig(),
  ...over,
});

function setup(over: Partial<CameraConfig> = {}): { ship: Ship; cam: Camera; cfg: CameraConfig } {
  const cfg = cfgWith(over);
  const ship = createShip(flight);
  return { ship, cam: createCamera(ship, flight, cfg), cfg };
}
function run(
  cam: Camera,
  ship: Ship,
  cfg: CameraConfig,
  seconds: number,
  events: GameEvent[] = [],
): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    stepCamera(cam, ship, flight, cfg, events, i * DT, DT);
  }
}

describe('zoom', () => {
  it('settles at viewMin at min speed and viewMax at max speed', () => {
    const { ship, cam, cfg } = setup();
    ship.speed = flight.minSpeed;
    run(cam, ship, cfg, 10);
    expect(cam.view).toBeCloseTo(cfg.viewMin, 0);
    ship.speed = flight.maxSpeed;
    run(cam, ship, cfg, 10);
    expect(cam.view).toBeCloseTo(cfg.viewMax, 0);
  });

  it('is smoothed and stays within [viewMin, viewMax]', () => {
    const { ship, cam, cfg } = setup();
    ship.speed = flight.minSpeed;
    run(cam, ship, cfg, 5);
    ship.speed = flight.maxSpeed;
    const before = cam.view;
    run(cam, ship, cfg, DT);
    const step = cam.view - before;
    expect(step).toBeGreaterThan(0);
    expect(step).toBeLessThan((cfg.viewMax - cfg.viewMin) * 0.1);
    for (let i = 0; i < 600; i++) {
      run(cam, ship, cfg, DT);
      expect(cam.view).toBeGreaterThanOrEqual(cfg.viewMin - 1e-6);
      expect(cam.view).toBeLessThanOrEqual(cfg.viewMax + 1e-6);
    }
  });
});

describe('look-ahead', () => {
  it('offsets toward the velocity at the capped distance at max speed', () => {
    const { ship, cam, cfg } = setup({ lookMode: 'velocity' });
    ship.speed = flight.maxSpeed;
    ship.vx = 0;
    ship.vy = flight.maxSpeed;
    ship.heading = 0; // nose differs from velocity
    run(cam, ship, cfg, 10);
    expect(cam.lookX).toBeCloseTo(0, 3);
    expect(cam.lookY).toBeCloseTo(cfg.lookAheadMax * (cam.view / 2), 1);
  });

  it('nose mode follows the heading instead', () => {
    const { ship, cam, cfg } = setup({ lookMode: 'nose' });
    ship.speed = flight.maxSpeed;
    ship.vx = 0;
    ship.vy = flight.maxSpeed;
    ship.heading = 0;
    run(cam, ship, cfg, 10);
    expect(cam.lookX).toBeGreaterThan(0);
    expect(cam.lookY).toBeCloseTo(0, 3);
  });

  it('never exceeds lookAheadMax half-widths, even with a large gain', () => {
    const { ship, cam, cfg } = setup({ lookAhead: 1 });
    ship.speed = flight.maxSpeed;
    ship.vx = flight.maxSpeed;
    run(cam, ship, cfg, 10);
    expect(Math.hypot(cam.lookX, cam.lookY)).toBeLessThanOrEqual(
      cfg.lookAheadMax * (cam.view / 2) + 1e-6,
    );
  });

  it('does not jerk when the velocity reverses', () => {
    const { ship, cam, cfg } = setup();
    ship.speed = flight.maxSpeed;
    ship.vx = flight.maxSpeed;
    run(cam, ship, cfg, 10);
    const full = cam.lookX;
    ship.vx = -flight.maxSpeed;
    run(cam, ship, cfg, DT);
    // One step moves only a small fraction of the 2*full swing.
    expect(Math.abs(cam.lookX - full)).toBeLessThan(2 * full * 0.1);
  });

  it('is zero at min speed', () => {
    const { ship, cam, cfg } = setup();
    ship.speed = flight.minSpeed;
    run(cam, ship, cfg, 10);
    expect(Math.hypot(cam.lookX, cam.lookY)).toBeCloseTo(0, 5);
  });
});

describe('maximum look-ahead settings', () => {
  it('the ranges allow a lean of a full half-screen and a gain of 2', async () => {
    const { cameraParams } = await import('../../../data/tuning/camera');
    expect(cameraParams.lookAheadMax.max).toBeGreaterThanOrEqual(1);
    expect(cameraParams.lookAhead.max).toBeGreaterThanOrEqual(2);
  });

  it('at the extremes the camera leans further than at the defaults, and the safe frame still holds', () => {
    const lean = (over: Partial<CameraConfig>): number => {
      const { ship, cam, cfg } = setup({ lookMode: 'velocity', ...over });
      ship.speed = flight.maxSpeed;
      ship.vx = flight.maxSpeed;
      run(cam, ship, cfg, 10);
      const size = viewSize(cam.view, cam.aspect);
      expect(Math.abs(ship.x - cam.x)).toBeLessThanOrEqual(
        (size.width / 2) * (1 - 2 * cfg.safeFrame) + 1e-6,
      );
      return Math.hypot(cam.lookX, cam.lookY);
    };
    const normal = lean({});
    const extreme = lean({ lookAhead: 2, lookAheadMax: 1, safeFrame: 0.05 });
    expect(extreme).toBeGreaterThan(normal * 2);
  });
});

describe('safe frame', () => {
  it('keeps the ship inside the safe area even if the look offset would push it out', () => {
    for (const aspect of [16 / 10, 1, 21 / 9]) {
      const { ship, cam, cfg } = setup({ lookAheadMax: 0.5, lookAhead: 1, safeFrame: 0.15 });
      cam.aspect = aspect;
      ship.speed = flight.maxSpeed;
      ship.vx = flight.maxSpeed;
      run(cam, ship, cfg, 10);
      const size = viewSize(cam.view, aspect);
      expect(Math.abs(ship.x - cam.x)).toBeLessThanOrEqual((size.width / 2) * 0.7 + 1e-6);
      expect(Math.abs(ship.y - cam.y)).toBeLessThanOrEqual((size.height / 2) * 0.7 + 1e-6);
    }
  });

  it('holds on the vertical axis for a tall aspect', () => {
    const { ship, cam, cfg } = setup({ lookAheadMax: 0.5, lookAhead: 1 });
    cam.aspect = 0.5;
    ship.speed = flight.maxSpeed;
    ship.vy = flight.maxSpeed;
    ship.vx = 0;
    run(cam, ship, cfg, 10);
    const size = viewSize(cam.view, 0.5);
    expect(Math.abs(ship.y - cam.y)).toBeLessThanOrEqual((size.height / 2) * 0.7 + 1e-6);
  });
});

describe('shake', () => {
  const hit: GameEvent = { type: 'Hit', x: 0, y: 0, dirX: 1, dirY: 0, impulse: 1 };

  it('is zero when disabled', () => {
    const { ship, cam, cfg } = setup({ shakeEnabled: false });
    run(cam, ship, cfg, 0.1, [hit]);
    expect([cam.shakeX, cam.shakeY]).toEqual([0, 0]);
  });

  it('kicks on a hit, stays bounded and decays to zero', () => {
    const { ship, cam, cfg } = setup({ shakeEnabled: true });
    stepCamera(cam, ship, flight, cfg, [hit], 0.5, DT);
    expect(Math.hypot(cam.shakeX, cam.shakeY)).toBeGreaterThan(0);
    for (let i = 0; i < 600; i++) {
      stepCamera(cam, ship, flight, cfg, [], i * DT, DT);
      expect(Math.abs(cam.shakeX)).toBeLessThanOrEqual(cfg.shake);
      expect(Math.abs(cam.shakeY)).toBeLessThanOrEqual(cfg.shake);
    }
    expect([cam.shakeX, cam.shakeY]).toEqual([0, 0]);
  });
});
