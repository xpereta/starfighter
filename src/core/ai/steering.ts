import type { FighterConfig } from '../../../data/tuning/fighter';
import type { FlightConfig } from '../../../data/tuning/flight';
import type { EventQueue } from '../events/events';
import { clamp } from '../math';

/** An event sink that drops everything: AI ships flying the flight model must not emit the player's evade events. */
export const noEvents: EventQueue = { events: [], emit: () => {}, clear: () => {} };

/**
 * Fills `out` with the fighter's own flight model settings: the player's, scaled in tuning.
 * Assigns in place (no allocation). Steering is always point-to-steer for the AI.
 */
export function deriveFlight(
  out: FlightConfig,
  flight: FlightConfig,
  cfg: FighterConfig,
): FlightConfig {
  Object.assign(out, flight);
  out.steering = 'point';
  out.maxSpeed = flight.maxSpeed * cfg.speedScale;
  out.cornerSpeed = Math.min(flight.cornerSpeed * cfg.speedScale, out.maxSpeed);
  out.cruiseSpeed = clamp(flight.cruiseSpeed * cfg.speedScale, flight.minSpeed, out.maxSpeed);
  out.maxTurnRate = flight.maxTurnRate * cfg.turnRateScale;
  out.turnRateAtMin = flight.turnRateAtMin * cfg.turnRateScale;
  out.turnRateAtMax = flight.turnRateAtMax * cfg.turnRateScale;
  return out;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Where to aim so a bullet fired now meets a moving target: the target's position advanced by its
 * velocity relative to the shooter over the bullet's flight time (capped by `maxLead` seconds).
 */
export function leadPoint(
  out: Point,
  shooter: { x: number; y: number; vx: number; vy: number },
  target: { x: number; y: number; vx: number; vy: number },
  bulletSpeed: number,
  maxLead: number,
): Point {
  const dx = target.x - shooter.x;
  const dy = target.y - shooter.y;
  const t = clamp(Math.hypot(dx, dy) / Math.max(bulletSpeed, 1e-6), 0, maxLead);
  out.x = target.x + (target.vx - shooter.vx) * t;
  out.y = target.y + (target.vy - shooter.vy) * t;
  return out;
}
