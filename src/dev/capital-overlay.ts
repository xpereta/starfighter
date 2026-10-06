import { CAPITAL_PARTS, coveredBy, isCovered, partCenter, scaleOf } from '../core/enemies/capital';
import type { World } from '../core/world/world';
import { worldToScreen } from '../render/hud/layout';

/**
 * Debug drawing for the capital ship (spec section 9): the hull circle, every part's hit shape (a
 * capsule is drawn as its two end circles and the lines between them), its hp as text, covered parts
 * dashed with a gold line to each plate that shields them, and each living turret's firing arc.
 */

const COLOR = {
  turret: 'rgba(255,170,60,0.9)',
  engine: 'rgba(90,200,255,0.9)',
  armour: 'rgba(170,180,200,0.9)',
  bridge: 'rgba(255,90,170,0.9)',
  core: 'rgba(255,210,74,1)',
} as const;
const DEAD = 'rgba(255,255,255,0.18)';
const SHIELD = 'rgba(255,210,74,0.8)';
const HULL = 'rgba(255,90,95,0.5)';
/** Length of a turret's arc wedge (u). */
const ARC_LENGTH = 220;

const a = { x: 0, y: 0 };
const b = { x: 0, y: 0 };
const c = { x: 0, y: 0 };

export function drawCapitalDebug(
  g: CanvasRenderingContext2D,
  world: World,
  center: { x: number; y: number },
  view: { width: number; height: number },
  screen: { width: number; height: number },
): void {
  const cap = world.enemies.capital;
  if (!cap) return;
  const scale = screen.width / view.width;
  const s = scaleOf(cap);
  g.lineWidth = 1.5;
  g.font = '11px ui-monospace, Menlo, Consolas, monospace';
  g.textAlign = 'left';
  worldToScreen(a, cap.x, cap.y, center, view, screen);
  g.setLineDash([10, 8]);
  g.strokeStyle = HULL;
  g.beginPath();
  g.arc(a.x, a.y, cap.hullRadius * scale, 0, Math.PI * 2);
  g.stroke();
  g.setLineDash([]);
  g.fillStyle = HULL;
  g.fillText(
    `capital  phase ${cap.phase}  t ${cap.time.toFixed(0)}s  v ${Math.hypot(cap.vx, cap.vy).toFixed(0)} u/s`,
    a.x + 8,
    a.y - 8,
  );
  const covers = coveredBy(CAPITAL_PARTS);
  CAPITAL_PARTS.forEach((def, i) => {
    const part = cap.parts[i]!;
    partCenter(b, cap, def);
    worldToScreen(c, b.x, b.y, center, view, screen);
    const r = def.radius * s * scale;
    const half = ((def.length ?? 0) / 2) * s * scale;
    const covered = part.alive && isCovered(cap, i);
    g.strokeStyle = part.alive ? COLOR[def.role] : DEAD;
    g.setLineDash(covered ? [4, 5] : []);
    // A capsule lies along the ship's forward axis: its end circles are half a length either side.
    const cos = Math.cos(cap.heading);
    const sin = Math.sin(cap.heading);
    const dx = cos * half;
    const dy = -sin * half; // screen y is down
    for (const end of half > 0 ? [-1, 1] : [0]) {
      g.beginPath();
      g.arc(c.x + dx * end, c.y + dy * end, r, 0, Math.PI * 2);
      g.stroke();
    }
    if (half > 0) {
      const nx = -dy / half || 0;
      const ny = dx / half || 0;
      g.beginPath();
      g.moveTo(c.x - dx + nx * r, c.y - dy + ny * r);
      g.lineTo(c.x + dx + nx * r, c.y + dy + ny * r);
      g.moveTo(c.x - dx - nx * r, c.y - dy - ny * r);
      g.lineTo(c.x + dx - nx * r, c.y + dy - ny * r);
      g.stroke();
    }
    g.setLineDash([]);
    if (part.alive) {
      g.fillStyle = COLOR[def.role];
      g.fillText(`${def.id} ${Math.ceil(part.hp)}/${Math.round(part.maxHp)}`, c.x - r, c.y - r - 4);
      // Shield lines: from each standing plate to what it covers.
      if (covered) {
        g.strokeStyle = SHIELD;
        for (const j of covers[i]!) {
          if (!cap.parts[j]!.alive) continue;
          partCenter(a, cap, CAPITAL_PARTS[j]!);
          worldToScreen(a, a.x, a.y, center, view, screen);
          g.beginPath();
          g.moveTo(c.x, c.y);
          g.lineTo(a.x, a.y);
          g.stroke();
        }
      }
      if (def.mount) {
        // The firing arc as a wedge, rotated with the ship.
        const m = def.mount;
        const from = cap.heading + m.arcCenter - m.arcHalf;
        const to = cap.heading + m.arcCenter + m.arcHalf;
        g.strokeStyle = 'rgba(255,170,60,0.35)';
        g.beginPath();
        g.moveTo(c.x, c.y);
        g.arc(c.x, c.y, ARC_LENGTH * scale, -from, -to, true);
        g.closePath();
        g.stroke();
      }
    }
  });
}
