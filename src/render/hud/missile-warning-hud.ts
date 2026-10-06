import {
  createMissileWarning,
  missileWarning,
  warningText,
} from '../../core/enemies/enemy-missiles-warning';
import type { World } from '../../core/world/world';
import { palette } from '../palette';
import { blinkOn, createEdgeIndicator, edgeIndicator, worldToScreen } from './layout';
import { markerPulse, MARKER_RADIUS, warningArrow } from './missile-warning';

/**
 * Drawing for the MISSILE warning of the classic HUD: a blinking `MISSILE` line, a red arrow on a
 * ring around the ship pointing at the nearest inbound missile, a red marker on every missile on
 * screen and an edge arrow for the ones off screen. All state comes from `missileWarning`
 * (read-only, in core); placement is in missile-warning.ts.
 */

const RED = `#${palette.enemy.toString(16).padStart(6, '0')}`;
const OUTLINE = 'rgba(0,0,0,0.6)';

const warning = createMissileWarning();
const edge = createEdgeIndicator();
const spot = { x: 0, y: 0 };
const arrow = { x: 0, y: 0, angle: 0 };
const body = { x: 0, y: 0, radius: 20 };

function triangle(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  s: number,
): void {
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  g.beginPath();
  g.moveTo(s, 0);
  g.lineTo(-s * 0.7, s * 0.8);
  g.lineTo(-s * 0.7, -s * 0.8);
  g.closePath();
  g.restore();
}

export function drawMissileWarning(
  g: CanvasRenderingContext2D,
  world: World,
  center: { x: number; y: number },
  view: { width: number; height: number },
  screen: { width: number; height: number },
): void {
  const w = missileWarning(world, warning);
  if (!w.active) return;
  const pool = world.enemies.missiles;
  const margin = world.tuning.hud.edgeMargin;
  const pulse = markerPulse(world.time, w.eta);

  // A red marker on every missile; off screen, an edge arrow instead.
  g.lineCap = 'round';
  for (let i = 0; i < pool.count; i++) {
    body.x = pool.data.x[i]!;
    body.y = pool.data.y[i]!;
    if (edgeIndicator(edge, body, center, view, screen, margin)) {
      triangle(g, edge.x, edge.y, edge.angle, 12);
      g.fillStyle = RED;
      g.fill();
      continue;
    }
    worldToScreen(spot, body.x, body.y, center, view, screen);
    const r = MARKER_RADIUS * (0.85 + 0.3 * pulse);
    g.lineWidth = 5;
    g.strokeStyle = OUTLINE;
    g.beginPath();
    g.arc(spot.x, spot.y, r, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 2.5;
    g.strokeStyle = RED;
    g.beginPath();
    g.arc(spot.x, spot.y, r, 0, Math.PI * 2);
    g.stroke();
  }

  // The arrow beside the ship, toward the nearest one.
  worldToScreen(spot, world.ship.x, world.ship.y, center, view, screen);
  warningArrow(arrow, spot.x, spot.y, w.angle);
  triangle(g, arrow.x, arrow.y, arrow.angle, 13);
  g.lineWidth = 4;
  g.strokeStyle = OUTLINE;
  g.stroke();
  g.fillStyle = RED;
  g.fill();

  // The line of text, blinking.
  if (blinkOn(world.time, world.tuning.hud.warningBlinkHz)) {
    const text = warningText(w);
    g.font = '700 20px ui-monospace, Menlo, Consolas, monospace';
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.lineWidth = 4;
    g.strokeStyle = OUTLINE;
    g.strokeText(text, screen.width / 2, 110);
    g.fillStyle = RED;
    g.fillText(text, screen.width / 2, 110);
  }
}
