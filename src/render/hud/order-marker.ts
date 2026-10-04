import { getLockable } from '../../core/world/lockable';
import type { World } from '../../core/world/world';
import { palette } from '../palette';
import { createLockRing, lockRingAt, type LockRing } from './locks';

/** The target of "attack my target": green corner brackets and a label, clearly unlike the gold lock rings. */

const COLOR = `#${palette.wingman.toString(16).padStart(6, '0')}`;
const OUTLINE = 'rgba(0,0,0,0.6)';
/** Smallest half-size (px) so brackets stay readable on small targets at max zoom-out. */
const MIN_HALF = 16;
const HALF_PER_RADIUS = 1.35; // brackets sit a little outside the target's circle
const CORNER_FRACTION = 0.45; // each corner arm is this fraction of the half-size

/** Half the side of the square the brackets frame, in px. */
export function bracketHalf(ringRadius: number): number {
  return Math.max(MIN_HALF, ringRadius * HALF_PER_RADIUS);
}

/** Length of one corner arm, in px. */
export function bracketArm(half: number): number {
  return half * CORNER_FRACTION;
}

const ring: LockRing = createLockRing();

function corners(g: CanvasRenderingContext2D, x: number, y: number, half: number): void {
  const arm = bracketArm(half);
  g.beginPath();
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const cx = x + sx * half;
      const cy = y + sy * half;
      g.moveTo(cx - sx * arm, cy);
      g.lineTo(cx, cy);
      g.lineTo(cx, cy - sy * arm);
    }
  }
  g.stroke();
}

/** Brackets and "ATTACK" on the order's target while an attack order is active and the target is on screen. */
export function drawOrderMarker(
  g: CanvasRenderingContext2D,
  world: World,
  center: { x: number; y: number },
  view: { width: number; height: number },
  screen: { width: number; height: number },
): void {
  const sq = world.squadron;
  if (sq.order !== 'attack') return;
  const body = getLockable(world, sq.orderTargetId);
  if (!body || !body.alive || !lockRingAt(ring, body, center, view, screen)) return;
  const half = bracketHalf(ring.radius);

  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.lineWidth = 6;
  g.strokeStyle = OUTLINE;
  corners(g, ring.x, ring.y, half);
  g.lineWidth = 3;
  g.strokeStyle = COLOR;
  corners(g, ring.x, ring.y, half);

  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.font = '700 12px ui-monospace, Menlo, Consolas, monospace';
  g.lineWidth = 3;
  g.strokeStyle = OUTLINE;
  g.strokeText('ATTACK', ring.x, ring.y - half - 8);
  g.fillStyle = COLOR;
  g.fillText('ATTACK', ring.x, ring.y - half - 8);
}
