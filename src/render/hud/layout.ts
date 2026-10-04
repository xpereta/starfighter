import type { FlightConfig } from '../../../data/tuning/flight';
import type { HudConfig } from '../../../data/tuning/hud';
import { clamp, lerp } from '../../core/math';

/** Where one off-screen target's arrow goes. Filled in place, so drawing allocates nothing per target. */
export interface EdgeIndicator {
  /** Screen position (CSS px, origin top-left) on the inset border. */
  x: number;
  y: number;
  /** Arrow direction in canvas radians (0 = right, +PI/2 = down). */
  angle: number;
  /** World distance from the camera center to the target. */
  distance: number;
}

export function createEdgeIndicator(): EdgeIndicator {
  return { x: 0, y: 0, angle: 0, distance: 0 };
}

/**
 * Computes the edge arrow for a target. Returns false (and leaves `out` alone) while any part of
 * the target is on screen. `view` is the visible world size, `screen` the canvas size in px.
 */
export function edgeIndicator(
  out: EdgeIndicator,
  target: { x: number; y: number; radius: number },
  camera: { x: number; y: number },
  view: { width: number; height: number },
  screen: { width: number; height: number },
  margin: number,
): boolean {
  const dx = target.x - camera.x;
  const dy = target.y - camera.y;
  const kx = screen.width / view.width;
  const ky = screen.height / view.height;
  // Screen-space offset from the center; world y is up, screen y is down.
  const sx = dx * kx;
  const sy = -dy * ky;
  const halfW = screen.width / 2;
  const halfH = screen.height / 2;
  if (Math.abs(sx) - target.radius * kx <= halfW && Math.abs(sy) - target.radius * ky <= halfH)
    return false;

  // Scale the direction until it hits the border inset by `margin`.
  const t = Math.min(
    (halfW - margin) / Math.abs(sx || 1e-9),
    (halfH - margin) / Math.abs(sy || 1e-9),
  );
  out.x = halfW + sx * t;
  out.y = halfH + sy * t;
  out.angle = Math.atan2(sy, sx);
  out.distance = Math.hypot(dx, dy);
  return true;
}

/** Nearer targets get bigger, more opaque arrows. */
export function distanceStyle(distance: number, cfg: HudConfig): { size: number; opacity: number } {
  const near = clamp(1 - distance / cfg.edgeRange, 0, 1);
  return {
    size: lerp(cfg.edgeSizeMin, cfg.edgeSizeMax, near),
    opacity: lerp(cfg.edgeOpacityMin, 1, near),
  };
}

/** Speed bar fractions (0..1 along the bar): current speed and the min / corner / cruise / max markers. */
export function speedBar(
  speed: number,
  flight: Pick<FlightConfig, 'minSpeed' | 'cornerSpeed' | 'cruiseSpeed' | 'maxSpeed'>,
): { fill: number; corner: number; cruise: number } {
  const span = flight.maxSpeed - flight.minSpeed;
  const frac = (v: number): number => clamp((v - flight.minSpeed) / span, 0, 1);
  return { fill: frac(speed), corner: frac(flight.cornerSpeed), cruise: frac(flight.cruiseSpeed) };
}

/** 0 right after an evade, 1 when ready again. */
export function evadeReadiness(cooldownLeft: number, cooldownTotal: number): number {
  return clamp(1 - cooldownLeft / cooldownTotal, 0, 1);
}

export type ThrottleState = 'BOOST' | 'CRUISE' | 'BRAKE';

export function throttleState(throttle: number, deadband: number): ThrottleState {
  return throttle > deadband ? 'BOOST' : throttle < -deadband ? 'BRAKE' : 'CRUISE';
}

/** Square-wave blink for the arena warning. */
export function blinkOn(time: number, hz: number): boolean {
  return Math.floor(time * hz * 2) % 2 === 0;
}

export interface SquadronReadout {
  /** 'TIGHT' or 'SPREAD'. */
  formation: string;
  /** Living / total wingmen, e.g. '2/2'. */
  wingmen: string;
  /** The active order with its time left, e.g. 'ATTACK 5.2s', or null when there is none. */
  order: string | null;
}

/** The squadron lines of the HUD; null when there are no wingmen (nothing to show). */
export function squadronReadout(
  squadron: { formation: 'tight' | 'spread'; order: 'none' | 'attack'; orderTimer: number },
  alive: number,
  total: number,
): SquadronReadout | null {
  if (total <= 0) return null;
  return {
    formation: squadron.formation === 'tight' ? 'TIGHT' : 'SPREAD',
    wingmen: `${alive}/${total}`,
    order:
      squadron.order === 'attack' ? `ATTACK ${Math.max(0, squadron.orderTimer).toFixed(1)}s` : null,
  };
}

/** World point to screen px (origin top-left; world y is up, screen y is down). Fills `out`. */
export function worldToScreen(
  out: { x: number; y: number },
  wx: number,
  wy: number,
  camera: { x: number; y: number },
  view: { width: number; height: number },
  screen: { width: number; height: number },
): void {
  out.x = screen.width / 2 + ((wx - camera.x) * screen.width) / view.width;
  out.y = screen.height / 2 - ((wy - camera.y) * screen.height) / view.height;
}

/** The short message for an Attack my target press that could not act, or null when there is none. */
export function orderCueText(squadron: {
  cue: 'none' | 'no-target' | 'no-wingmen';
  cueTimer: number;
}): string | null {
  if (squadron.cueTimer <= 0) return null;
  if (squadron.cue === 'no-target') return 'ATTACK: NO TARGET';
  if (squadron.cue === 'no-wingmen') return 'ATTACK: NO WINGMEN';
  return null;
}
