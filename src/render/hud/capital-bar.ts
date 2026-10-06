import { createCapitalBar, fillCapitalBar, type BarSegment } from '../../core/enemies/capital-hud';
import type { PartRole } from '../../core/enemies/capital-parts';
import type { World } from '../../core/world/world';
import { palette } from '../palette';
import { blinkOn } from './layout';

/**
 * The capital ship's health bar at the top of the screen (spec section 8): one segment per part,
 * grouped by role with a gap between groups, the core wide and outlined in gold, the plates that
 * cover it underlined in gold while they stand, a destroyed part an empty crossed box. The data is
 * `core/enemies/capital-hud.ts`; the placement here is pure and tested (`barRects`).
 */

/** Width of a segment by role (relative), so the core reads at a glance and turrets stay small. */
export const SEGMENT_WEIGHT: Record<PartRole, number> = {
  turret: 1,
  engine: 1.3,
  bridge: 1.3,
  armour: 1.6,
  core: 3,
};
/** Gap between neighbours in a group, and between two groups (px). */
const GAP = 3;
const GROUP_GAP = 10;
/** Bar height (px) and its distance from the top edge. */
export const BAR_HEIGHT = 12;
export const BAR_TOP = 8;
/** Widest the bar gets (px) and the share of the screen width it may take. */
export const BAR_MAX_WIDTH = 560;
export const BAR_SCREEN_SHARE = 0.5;

export interface BarRect {
  x: number;
  width: number;
}

/**
 * Places the segments across `width` px starting at `left`: widths follow `WEIGHT`, with a gap
 * between neighbours and a bigger one where the role changes. Fills `out` (one rect per segment) and
 * returns it. Pure.
 */
export function barRects(
  out: BarRect[],
  segments: readonly Pick<BarSegment, 'role'>[],
  left: number,
  width: number,
): BarRect[] {
  let gaps = 0;
  let weight = 0;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    weight += SEGMENT_WEIGHT[seg.role];
    if (i > 0) gaps += seg.role === segments[i - 1]!.role ? GAP : GROUP_GAP;
  }
  const unit = Math.max(0, width - gaps) / Math.max(weight, 1e-9);
  let x = left;
  while (out.length < segments.length) out.push({ x: 0, width: 0 });
  out.length = segments.length;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    if (i > 0) x += seg.role === segments[i - 1]!.role ? GAP : GROUP_GAP;
    const rect = out[i]!;
    rect.x = x;
    rect.width = SEGMENT_WEIGHT[seg.role] * unit;
    x += rect.width;
  }
  return out;
}

const css = (hex: number): string => `#${hex.toString(16).padStart(6, '0')}`;
const GOLD = '#ffd24a';
const bar = createCapitalBar();
const rects: BarRect[] = [];

function colorOf(seg: BarSegment): string {
  if (seg.role === 'turret') return css(palette.turret);
  if (seg.role === 'core') return GOLD;
  if (seg.role === 'armour') return '#9aa4b8';
  return css(palette.enemy);
}

/** Draws the bar and its caption while a capital ship is on the field (nothing otherwise). */
export function drawCapitalBar(
  g: CanvasRenderingContext2D,
  world: World,
  screen: { width: number; height: number },
): void {
  const cap = world.enemies.capital;
  if (!cap || cap.phase === 2) return; // gone, or destroyed: no bar on the end screens
  if (world.run.mode === 'run' && world.run.phase !== 'battle') return;
  fillCapitalBar(bar, cap);
  const width = Math.min(BAR_MAX_WIDTH, screen.width * BAR_SCREEN_SHARE);
  const left = (screen.width - width) / 2;
  barRects(rects, bar.segments, left, width);
  g.save();
  g.font = '700 11px ui-monospace, Menlo, Consolas, monospace';
  g.textBaseline = 'middle';
  g.textAlign = 'right';
  g.fillStyle = css(palette.enemy);
  g.fillText('CAPITAL SHIP', left - 10, BAR_TOP + BAR_HEIGHT / 2);
  for (let i = 0; i < bar.segments.length; i++) {
    const seg = bar.segments[i]!;
    const r = rects[i]!;
    const y = BAR_TOP;
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(r.x, y, r.width, BAR_HEIGHT);
    if (seg.alive) {
      g.fillStyle = colorOf(seg);
      g.globalAlpha = seg.covered ? 0.55 : 1;
      g.fillRect(r.x, y, r.width * seg.fraction, BAR_HEIGHT);
      g.globalAlpha = 1;
    } else {
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(r.x, y);
      g.lineTo(r.x + r.width, y + BAR_HEIGHT);
      g.moveTo(r.x + r.width, y);
      g.lineTo(r.x, y + BAR_HEIGHT);
      g.stroke();
    }
    if (seg.isCore) {
      g.strokeStyle = GOLD;
      g.lineWidth = 2;
      g.strokeRect(r.x - 1, y - 1, r.width + 2, BAR_HEIGHT + 2);
    } else if (seg.coversCore && seg.alive) {
      // A plate that still shields the core: a gold underline, so the order of play is readable.
      g.fillStyle = GOLD;
      g.fillRect(r.x, y + BAR_HEIGHT + 2, r.width, 3);
    }
  }
  // The one line that says what to do next.
  const { standing, total } = bar.corePlates;
  const text =
    bar.phase !== 0
      ? 'CAPITAL SHIP BREAKING UP'
      : bar.coreExposed
        ? 'CORE EXPOSED'
        : `CORE SHIELDED  ${standing}/${total} PLATES`;
  const flash =
    bar.coreExposed && bar.phase === 0 && !blinkOn(world.time, world.tuning.hud.warningBlinkHz);
  g.textAlign = 'left';
  g.fillStyle = flash ? 'rgba(255,210,74,0.35)' : GOLD;
  g.fillText(text, left + width + 10, BAR_TOP + BAR_HEIGHT / 2);
  g.restore();
}
