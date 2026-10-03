import { DEG } from '../core/math';
import { getLockable } from '../core/world/lockable';
import type { World } from '../core/world/world';
import { lockDebugLabel } from '../render/hud/locks';
import { worldToScreen } from '../render/hud/layout';

/** Debug overlay: the lock-on cone, and the lock state of every target in the lock system. */
export function drawLockDebug(
  g: CanvasRenderingContext2D,
  world: World,
  center: { x: number; y: number },
  view: { width: number; height: number },
  screen: { width: number; height: number },
): void {
  const { ship, lockon } = world;
  const cfg = world.tuning.lockon;
  const half = cfg.coneHalfAngle * DEG;
  const scale = screen.width / view.width;
  const p = { x: 0, y: 0 };

  // The cone: ship nose, half-angle each side, out to the lock range. Canvas y points down.
  worldToScreen(p, ship.x, ship.y, center, view, screen);
  const r = cfg.lockRange * scale;
  g.beginPath();
  g.moveTo(p.x, p.y);
  g.arc(p.x, p.y, r, -(ship.heading + half), -(ship.heading - half));
  g.closePath();
  g.fillStyle = 'rgba(255,210,74,0.06)';
  g.fill();
  g.strokeStyle = 'rgba(255,210,74,0.5)';
  g.setLineDash([4, 6]);
  g.stroke();
  g.setLineDash([]);

  // Lock state next to each target in the lock system.
  g.font = '12px ui-monospace, Menlo, Consolas, monospace';
  g.textAlign = 'left';
  g.fillStyle = 'rgba(255,210,74,0.95)';
  const label = (id: number, text: string): void => {
    const body = getLockable(world, id);
    if (!body) return;
    worldToScreen(p, body.x, body.y, center, view, screen);
    g.fillText(text, p.x + body.radius * scale + 8, p.y - 6);
  };
  lockon.locks.forEach((id, i) =>
    label(id, lockDebugLabel(i + 1, 0, cfg.lockTime, lockon.graces[i]!)),
  );
  if (lockon.acquiringId >= 0) {
    label(
      lockon.acquiringId,
      lockDebugLabel(0, lockon.progress, cfg.lockTime, lockon.acquiringGrace),
    );
  }
}
