import { clamp, TAU } from '../../core/math';
import { evadeReadiness, worldToScreen } from './layout';

/** Pure layout math for the lock rings and the locks/salvo panel (no DOM), so it can be unit-tested. */

/** Smallest ring radius on screen, so rings stay readable when zoomed far out. */
export const RING_MIN_PX = 16;
/** Rings are this much bigger than the target they circle, plus `RING_PAD_PX`. */
export const RING_PAD = 1.35;
export const RING_PAD_PX = 4;

/** Ring radius in screen pixels for a body of `radiusWorld` world units at `pxPerUnit` zoom. */
export function ringRadiusPx(radiusWorld: number, pxPerUnit: number): number {
  return Math.max(RING_MIN_PX, radiusWorld * pxPerUnit * RING_PAD + RING_PAD_PX);
}

/** Where a lock ring goes on screen. Filled in place, so drawing allocates nothing per target. */
export interface LockRing {
  x: number;
  y: number;
  radius: number;
}

export function createLockRing(): LockRing {
  return { x: 0, y: 0, radius: 0 };
}

/**
 * Fills `out` with the ring for a body and returns whether any part of it is on screen.
 * `view` is the visible world size, `screen` the canvas size in px.
 */
export function lockRingAt(
  out: LockRing,
  body: { x: number; y: number; radius: number },
  camera: { x: number; y: number },
  view: { width: number; height: number },
  screen: { width: number; height: number },
): boolean {
  worldToScreen(out, body.x, body.y, camera, view, screen);
  out.radius = ringRadiusPx(body.radius, screen.width / view.width);
  return (
    out.x + out.radius >= 0 &&
    out.x - out.radius <= screen.width &&
    out.y + out.radius >= 0 &&
    out.y - out.radius <= screen.height
  );
}

/** End angle (canvas radians) of the clockwise sweep that starts at 12 o'clock and fills with progress. */
export function sweepEnd(progress: number, lockTime: number): number {
  return -Math.PI / 2 + clamp(progress / lockTime, 0, 1) * TAU;
}

/** Offset of the lock-order number from the ring center: upper right, just outside the ring. */
export function orderLabelOffset(radius: number): { dx: number; dy: number } {
  const d = radius * 0.8;
  return { dx: d, dy: -d };
}

export interface LockPanel {
  /** "LOCKS 2/3": locks held over the limit. */
  locksText: string;
  /** "SALVO READY", "SALVO 2.5s" or "NO LOCK". */
  salvoText: string;
  /** 0 right after a launch, 1 when the salvo is ready again. */
  readiness: number;
  /** True when pressing launch would fire a salvo right now. */
  ready: boolean;
}

export function lockPanel(
  locks: number,
  limit: number,
  cooldownLeft: number,
  cooldownTotal: number,
): LockPanel {
  const readiness = evadeReadiness(cooldownLeft, cooldownTotal);
  const ready = locks > 0 && cooldownLeft <= 0;
  const salvoText =
    cooldownLeft > 0 ? `SALVO ${cooldownLeft.toFixed(1)}s` : locks > 0 ? 'SALVO READY' : 'NO LOCK';
  return { locksText: `LOCKS ${locks}/${limit}`, salvoText, readiness, ready };
}

/** Debug label for a target in the lock system: its lock order, or the acquisition progress. */
export function lockDebugLabel(
  order: number,
  progress: number,
  lockTime: number,
  grace: number,
): string {
  if (order > 0)
    return grace > 0 ? `LOCK #${order} (grace ${grace.toFixed(2)}s)` : `LOCK #${order}`;
  const pct = Math.round(clamp(progress / lockTime, 0, 1) * 100);
  return grace > 0 ? `ACQUIRING ${pct}% (grace ${grace.toFixed(2)}s)` : `ACQUIRING ${pct}%`;
}
