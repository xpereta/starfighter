import { leadPoint, type Point } from '../core/ai/steering';
import { targetOf } from '../core/ai/fighters';
import { slotFrame, slotPosition } from '../core/squadron/formation';
import { bodyOf, slotOf } from '../core/squadron/wingmen';
import { getLockable } from '../core/world/lockable';
import type { World } from '../core/world/world';
import { worldToScreen } from '../render/hud/layout';

/** Debug drawing of what the AI is doing: fighter targets and lead points, wingman engagements and slots, missile targets. */

const FIGHTER_COLOR = 'rgba(255,59,107,0.65)';
const WINGMAN_COLOR = 'rgba(125,255,176,0.7)';
const MISSILE_COLOR = 'rgba(255,255,255,0.35)';
const DASH: [number, number] = [6, 6];

const a = { x: 0, y: 0 };
const b = { x: 0, y: 0 };
const lead: Point = { x: 0, y: 0 };
const slot: Point = { x: 0, y: 0 };
const frame = { x: 0, y: 0, heading: 0 };

type View = { width: number; height: number };
type Screen = { width: number; height: number };

function dashedLine(
  g: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  color: string,
): void {
  g.strokeStyle = color;
  g.setLineDash(DASH);
  g.beginPath();
  g.moveTo(from.x, from.y);
  g.lineTo(to.x, to.y);
  g.stroke();
  g.setLineDash([]);
}

function diamond(
  g: CanvasRenderingContext2D,
  p: { x: number; y: number },
  r: number,
  color: string,
): void {
  g.strokeStyle = color;
  g.beginPath();
  g.moveTo(p.x, p.y - r);
  g.lineTo(p.x + r, p.y);
  g.lineTo(p.x, p.y + r);
  g.lineTo(p.x - r, p.y);
  g.closePath();
  g.stroke();
}

export function drawIntents(
  g: CanvasRenderingContext2D,
  world: World,
  center: { x: number; y: number },
  view: View,
  screen: Screen,
): void {
  g.lineWidth = 1.5;
  g.font = '11px ui-monospace, Menlo, Consolas, monospace';
  g.textAlign = 'left';

  // Enemy fighters: a line to the target, the lead point they aim at, and BREAK while breaking away.
  const fcfg = world.tuning.fighter;
  for (const f of world.fighters) {
    if (!f.alive) continue;
    const target = targetOf(world, f.targetIndex);
    if (!target) continue;
    worldToScreen(a, f.ship.x, f.ship.y, center, view, screen);
    worldToScreen(b, target.x, target.y, center, view, screen);
    dashedLine(g, a, b, FIGHTER_COLOR);
    leadPoint(lead, f.ship, target, fcfg.bulletSpeed, fcfg.leadTimeMax);
    worldToScreen(b, lead.x, lead.y, center, view, screen);
    diamond(g, b, 6, FIGHTER_COLOR);
    if (f.breakTimer > 0) {
      g.fillStyle = FIGHTER_COLOR;
      g.fillText('BREAK', a.x + 14, a.y - 14);
    }
  }

  // Wingmen: the enemy they engage (with the lead point), otherwise their slot, and any catch-up boost.
  const scfg = world.tuning.squadron;
  const bulletSpeed = world.tuning.weapons.bulletSpeed;
  const count = world.squadron.wingmen.length;
  world.squadron.wingmen.forEach((w, i) => {
    if (!w.alive) return;
    worldToScreen(a, w.ship.x, w.ship.y, center, view, screen);
    const enemy = bodyOf(world, w.engagedId);
    if (enemy) {
      worldToScreen(b, enemy.x, enemy.y, center, view, screen);
      dashedLine(g, a, b, WINGMAN_COLOR);
      leadPoint(lead, w.ship, enemy, bulletSpeed, scfg.fireRange / bulletSpeed);
      worldToScreen(b, lead.x, lead.y, center, view, screen);
      diamond(g, b, 6, WINGMAN_COLOR);
    } else {
      const rank = slotOf(world, i, count); // in a run the slots go to the living wingmen only
      slotPosition(
        slot,
        world.squadron.formation,
        rank.index,
        rank.count,
        slotFrame(frame, world.ship, scfg.slotAnchor),
        scfg,
      );
      worldToScreen(b, slot.x, slot.y, center, view, screen);
      dashedLine(g, a, b, WINGMAN_COLOR);
      g.strokeStyle = WINGMAN_COLOR;
      g.beginPath();
      g.arc(b.x, b.y, 8, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = WINGMAN_COLOR;
      g.fillText(`slot ${i + 1}`, b.x + 11, b.y + 4);
    }
    if (w.catchUp > 0.05) {
      g.fillStyle = WINGMAN_COLOR;
      g.fillText(`boost +${Math.round(w.catchUp * 100)}%`, a.x + 14, a.y + 18);
    }
  });

  // Missiles: a line to the target they are homing on.
  const m = world.missiles;
  for (let i = 0; i < m.count; i++) {
    const id = m.data.targetId[i]!;
    if (id < 0) continue;
    const target = getLockable(world, id);
    if (!target || !target.alive) continue;
    worldToScreen(a, m.data.x[i]!, m.data.y[i]!, center, view, screen);
    worldToScreen(b, target.x, target.y, center, view, screen);
    dashedLine(g, a, b, MISSILE_COLOR);
  }
}
