import { getLockable } from '../../core/world/lockable';
import type { World } from '../../core/world/world';
import { palette } from '../palette';
import {
  createLockRing,
  lockPanel,
  lockRingAt,
  orderLabelOffset,
  sweepEnd,
  type LockRing,
} from './locks';

/** Drawing for the lock rings and the locks/salvo panel. All placement math lives in locks.ts. */

const PAD = 24;
const BAR_W = 120;
const BAR_H = 6;
/**
 * The panel sits in the bottom-left column, above the speed readout drawn by hud.ts
 * (about 64 px tall from the bottom padding up).
 */
const PANEL_BOTTOM_OFFSET = 64;
const LOCK_COLOR = `#${palette.lockRing.toString(16).padStart(6, '0')}`;
/** A dark under-stroke keeps the gold ring readable over bright targets and shards. */
const OUTLINE = 'rgba(0,0,0,0.6)';

const ring: LockRing = createLockRing();

function strokeCircle(
  g: CanvasRenderingContext2D,
  r: LockRing,
  width: number,
  color: string,
  from = 0,
  to = Math.PI * 2,
): void {
  g.lineWidth = width;
  g.strokeStyle = color;
  g.beginPath();
  g.arc(r.x, r.y, r.radius, from, to);
  g.stroke();
}

/** Rings on the targets being acquired (a filling sweep) and locked (solid, with the lock order). */
export function drawLockRings(
  g: CanvasRenderingContext2D,
  world: World,
  center: { x: number; y: number },
  view: { width: number; height: number },
  screen: { width: number; height: number },
): void {
  const { lockon } = world;
  const lockTime = world.tuning.lockon.lockTime;

  if (lockon.acquiringId >= 0) {
    const body = getLockable(world, lockon.acquiringId);
    if (body && lockRingAt(ring, body, center, view, screen)) {
      strokeCircle(g, ring, 4, OUTLINE);
      strokeCircle(g, ring, 1.5, 'rgba(255,210,74,0.35)'); // the full ring, thin and faint
      const end = sweepEnd(lockon.progress, lockTime);
      strokeCircle(g, ring, 5, OUTLINE, -Math.PI / 2, end);
      strokeCircle(g, ring, 3, LOCK_COLOR, -Math.PI / 2, end); // the filling part
    }
  }

  g.textAlign = 'center';
  g.textBaseline = 'middle';
  lockon.locks.forEach((id, i) => {
    const body = getLockable(world, id);
    if (!body || !lockRingAt(ring, body, center, view, screen)) return;
    strokeCircle(g, ring, 6, OUTLINE);
    strokeCircle(g, ring, 3, LOCK_COLOR);
    const { dx, dy } = orderLabelOffset(ring.radius);
    g.fillStyle = OUTLINE;
    g.beginPath();
    g.arc(ring.x + dx, ring.y + dy, 9, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = LOCK_COLOR;
    g.fillText(String(i + 1), ring.x + dx, ring.y + dy + 1);
  });
  g.textBaseline = 'alphabetic';
}

/** "LOCKS 2/3" and the salvo bar (fills as the cooldown ends; READY when a press would fire). */
export function drawLockPanel(
  g: CanvasRenderingContext2D,
  world: World,
  limit: number,
  screenHeight: number,
): void {
  const { lockon, missiles, tuning } = world;
  const panel = lockPanel(
    lockon.locks.length,
    limit,
    missiles.salvo.cooldown,
    tuning.missiles.salvoCooldown,
  );
  const barY = screenHeight - PAD - PANEL_BOTTOM_OFFSET;

  g.textAlign = 'left';
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.fillText(panel.locksText, PAD, barY - 8);

  g.fillStyle = 'rgba(255,255,255,0.15)';
  g.fillRect(PAD, barY, BAR_W, BAR_H);
  g.fillStyle = panel.ready ? LOCK_COLOR : 'rgba(255,255,255,0.45)';
  g.fillRect(PAD, barY, BAR_W * panel.readiness, BAR_H);
  g.fillStyle = panel.ready ? LOCK_COLOR : 'rgba(255,255,255,0.8)';
  g.fillText(panel.salvoText, PAD + BAR_W + 10, barY + BAR_H + 2);
}
