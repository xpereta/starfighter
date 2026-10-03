import type { CameraConfig } from '../../../data/tuning/camera';
import type { FlightConfig } from '../../../data/tuning/flight';
import type { GameEvent } from '../events/events';
import type { Ship } from '../flight/flight';
import { clamp, lerp } from '../math';
import { viewSize } from './view';

/** Camera state. Pure data; the renderer applies it. */
export interface Camera {
  /** Center of the view (without shake), world units. */
  x: number;
  y: number;
  /** Visible width on the reference aspect (see `viewSize`). */
  view: number;
  /** Smoothed look-ahead offset from the ship. */
  lookX: number;
  lookY: number;
  /** Shake offset to add to the center when rendering. */
  shakeX: number;
  shakeY: number;
  /** Shake intensity 0..1, decays over time. */
  trauma: number;
  /** Screen width / height, written by the app each frame (core cannot read the DOM). */
  aspect: number;
}

const SHAKE_PER_SHOT = 0.04;
const SHAKE_PER_HIT = 0.3;
const SHAKE_FREQ_X = 47; // rad/s, arbitrary incommensurate frequencies for a jittery look
const SHAKE_FREQ_Y = 61;

const speedFactor = (ship: Ship, flight: FlightConfig): number =>
  clamp((ship.speed - flight.minSpeed) / (flight.maxSpeed - flight.minSpeed), 0, 1);

export function createCamera(ship: Ship, flight: FlightConfig, cam: CameraConfig): Camera {
  return {
    x: ship.x,
    y: ship.y,
    view: lerp(cam.viewMin, cam.viewMax, speedFactor(ship, flight)),
    lookX: 0,
    lookY: 0,
    shakeX: 0,
    shakeY: 0,
    trauma: 0,
    aspect: 1280 / 800,
  };
}

/** Exponential smoothing factor for a rate in 1/s: framerate independent. */
const smooth = (rate: number, dt: number): number => 1 - Math.exp(-rate * dt);

export function stepCamera(
  camera: Camera,
  ship: Ship,
  flight: FlightConfig,
  cfg: CameraConfig,
  events: readonly GameEvent[],
  time: number,
  dt: number,
): void {
  const sf = speedFactor(ship, flight);

  // Zoom by speed, smoothed.
  const targetView = lerp(cfg.viewMin, cfg.viewMax, sf);
  camera.view += (targetView - camera.view) * smooth(cfg.zoomLerp, dt);

  // Look-ahead: toward the velocity (default) or the nose, capped, smoothed so turns never jerk the view.
  const halfWidth = camera.view / 2;
  let dirX = Math.cos(ship.heading);
  let dirY = Math.sin(ship.heading);
  if (cfg.lookMode === 'velocity') {
    const v = Math.hypot(ship.vx, ship.vy);
    if (v > 0) {
      dirX = ship.vx / v;
      dirY = ship.vy / v;
    }
  }
  const reach = Math.min(cfg.lookAheadMax, cfg.lookAhead * sf) * halfWidth;
  const k = smooth(cfg.lookLerp, dt);
  camera.lookX += (dirX * reach - camera.lookX) * k;
  camera.lookY += (dirY * reach - camera.lookY) * k;

  camera.x = ship.x + camera.lookX;
  camera.y = ship.y + camera.lookY;

  // Safe frame: keep the ship at least `safeFrame` of the screen away from every edge.
  const size = viewSize(camera.view, camera.aspect);
  const limitX = (size.width / 2) * (1 - 2 * cfg.safeFrame);
  const limitY = (size.height / 2) * (1 - 2 * cfg.safeFrame);
  camera.x = ship.x + clamp(camera.x - ship.x, -limitX, limitX);
  camera.y = ship.y + clamp(camera.y - ship.y, -limitY, limitY);

  // Shake: events add trauma, trauma decays; the offset is deterministic (a function of sim time).
  for (const e of events) {
    if (e.type === 'ShotFired') camera.trauma += SHAKE_PER_SHOT;
    else if (e.type === 'Hit') camera.trauma += SHAKE_PER_HIT;
  }
  camera.trauma = clamp(camera.trauma, 0, 1) * Math.exp(-cfg.shakeDecay * dt);
  if (cfg.shakeEnabled && camera.trauma > 1e-3) {
    const amount = cfg.shake * camera.trauma * camera.trauma;
    camera.shakeX = Math.sin(time * SHAKE_FREQ_X) * amount;
    camera.shakeY = Math.cos(time * SHAKE_FREQ_Y) * amount;
  } else {
    camera.shakeX = 0;
    camera.shakeY = 0;
  }
}
