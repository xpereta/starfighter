import { getLockable } from '../../core/world/lockable';
import type { World } from '../../core/world/world';
import { drawLockRings } from '../../render/hud/locks-hud';
import { worldToScreen } from '../../render/hud/layout';
import { createLockRing, lockRingAt, sweepEnd, type LockRing } from '../../render/hud/locks';
import { drawOrderMarker } from '../../render/hud/order-marker';
import { drawPodRings } from '../../render/hud/pods-hud';
import {
  pipOffsets,
  podLabel,
  progressEnd,
  progressRingRadius,
  rescueRingRadius,
} from '../../render/hud/pods';
import type { UiColors } from './presentation';
import {
  armLength,
  beaconRing,
  BEACON_RINGS,
  bracketDistance,
  CORNERS,
  lockPulse,
  PULSE_SECONDS,
  reticleSpin,
} from './reticle';

/**
 * Everything on the HUD that is anchored to the world (lock reticles, the rescue beacon and the
 * formation-order marker). Drawn on its own canvas that gets the same CSS transform as the world
 * canvas, so a zoom punch or roll moves the reticles with the targets. With `dramatic` off it falls back
 * to the classic drawing, so the `locks` switch only changes the style, never what is shown.
 */

export interface WorldLayerInput {
  world: World;
  center: { x: number; y: number };
  view: { width: number; height: number };
  screen: { width: number; height: number };
  /** Seconds, wall clock (animation only). */
  time: number;
  /** Seconds since each locked target's `LockAcquired`, by lockable id. */
  pulses: ReadonlyMap<number, number>;
  dramatic: boolean;
  colors: UiColors;
}

const FONT = '700 11px ui-monospace, Menlo, Consolas, monospace';
const INK = 'rgba(4, 6, 20, 0.75)';

const ring: LockRing = createLockRing();
const p = { x: 0, y: 0 };
const pips: number[] = [];

function glow(g: CanvasRenderingContext2D, color: string, blur: number): void {
  g.shadowColor = color;
  g.shadowBlur = blur;
}
function noGlow(g: CanvasRenderingContext2D): void {
  g.shadowBlur = 0;
  g.shadowColor = 'transparent';
}

/** A slanted plate (parallelogram) centred on x,y. */
export function plate(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  skew: number,
): void {
  g.beginPath();
  g.moveTo(x - w / 2 + skew, y - h / 2);
  g.lineTo(x + w / 2 + skew, y - h / 2);
  g.lineTo(x + w / 2 - skew, y + h / 2);
  g.lineTo(x - w / 2 - skew, y + h / 2);
  g.closePath();
}

function brackets(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  half: number,
  rotate: number,
): void {
  const arm = armLength(half);
  g.save();
  g.translate(x, y);
  g.rotate(rotate);
  g.beginPath();
  for (const [sx, sy] of CORNERS) {
    const cx = sx * half;
    const cy = sy * half;
    g.moveTo(cx - sx * arm, cy);
    g.lineTo(cx, cy);
    g.lineTo(cx, cy - sy * arm);
  }
  g.stroke();
  g.restore();
}

function arc(g: CanvasRenderingContext2D, r: LockRing, radius: number, from: number, to: number) {
  g.beginPath();
  g.arc(r.x, r.y, radius, from, to);
  g.stroke();
}

function drawAcquiring(g: CanvasRenderingContext2D, i: WorldLayerInput): void {
  const { world } = i;
  const { lockon } = world;
  if (lockon.acquiringId < 0) return;
  const body = getLockable(world, lockon.acquiringId);
  if (!body || !lockRingAt(ring, body, i.center, i.view, i.screen)) return;
  const prog = Math.max(0, Math.min(1, lockon.progress / world.tuning.lockon.lockTime));
  const dist = bracketDistance(ring.radius, prog);
  const gold = i.colors.gold;
  g.lineCap = 'round';
  g.lineJoin = 'miter';

  g.strokeStyle = INK;
  g.lineWidth = 6;
  brackets(g, ring.x, ring.y, dist, Math.PI / 4 - prog * (Math.PI / 4));
  glow(g, gold, 10);
  g.strokeStyle = prog > 0.9 ? '#ffffff' : gold;
  g.lineWidth = 3;
  brackets(g, ring.x, ring.y, dist, Math.PI / 4 - prog * (Math.PI / 4));

  // The ring itself: a faint spinning dashed circle and the filling sweep.
  g.save();
  g.setLineDash([6, 10]);
  g.lineDashOffset = -reticleSpin(i.time, false) * 40;
  g.strokeStyle = 'rgba(255, 210, 63, 0.5)';
  g.lineWidth = 1.5;
  arc(g, ring, ring.radius * 1.12, 0, Math.PI * 2);
  g.restore();
  g.strokeStyle = INK;
  g.lineWidth = 7;
  arc(g, ring, ring.radius, -Math.PI / 2, sweepEnd(lockon.progress, world.tuning.lockon.lockTime));
  glow(g, gold, 14);
  g.strokeStyle = gold;
  g.lineWidth = 4;
  arc(g, ring, ring.radius, -Math.PI / 2, sweepEnd(lockon.progress, world.tuning.lockon.lockTime));
  noGlow(g);

  g.font = FONT;
  g.textAlign = 'center';
  g.textBaseline = 'top';
  g.fillStyle = gold;
  g.fillText(`LOCKING ${Math.round(prog * 100)}%`, ring.x, ring.y + dist + 6);
  g.textBaseline = 'alphabetic';
}

function drawLocked(g: CanvasRenderingContext2D, i: WorldLayerInput): void {
  const { world } = i;
  const gold = i.colors.gold;
  worldToScreen(p, world.ship.x, world.ship.y, i.center, i.view, i.screen);
  const shipX = p.x;
  const shipY = p.y;
  world.lockon.locks.forEach((id, n) => {
    const body = getLockable(world, id);
    if (!body || !lockRingAt(ring, body, i.center, i.view, i.screen)) return;

    // The tether from the ship: a thin dashed line, so the player sees what the salvo will go for.
    g.save();
    g.setLineDash([4, 8]);
    g.lineDashOffset = -i.time * 30;
    g.strokeStyle = 'rgba(255, 210, 63, 0.28)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(shipX, shipY);
    g.lineTo(ring.x, ring.y);
    g.stroke();
    g.restore();

    // The pulse ring that lands with the lock.
    const age = i.pulses.get(id);
    if (age !== undefined && age < PULSE_SECONDS) {
      const pulse = lockPulse(age);
      g.globalAlpha = pulse.alpha;
      g.strokeStyle = '#ffffff';
      g.lineWidth = 3;
      arc(g, ring, ring.radius * pulse.scale, 0, Math.PI * 2);
      g.globalAlpha = 1;
    }

    // Solid ring, a slow spinning outer dash, and snapped diamond brackets.
    g.strokeStyle = INK;
    g.lineWidth = 8;
    arc(g, ring, ring.radius, 0, Math.PI * 2);
    glow(g, gold, 12);
    g.strokeStyle = gold;
    g.lineWidth = 3.5;
    arc(g, ring, ring.radius, 0, Math.PI * 2);
    noGlow(g);
    g.save();
    g.setLineDash([10, 12]);
    g.lineDashOffset = -reticleSpin(i.time, true) * 40;
    g.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    g.lineWidth = 1.5;
    arc(g, ring, ring.radius * 1.22, 0, Math.PI * 2);
    g.restore();
    g.strokeStyle = INK;
    g.lineWidth = 6;
    brackets(g, ring.x, ring.y, ring.radius * 1.5, Math.PI / 4);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 2.5;
    brackets(g, ring.x, ring.y, ring.radius * 1.5, Math.PI / 4);

    // The lock order on a slanted plate at the upper right.
    const px = ring.x + ring.radius * 1.15;
    const py = ring.y - ring.radius * 1.15;
    plate(g, px, py, 26, 20, 4);
    g.fillStyle = gold;
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = INK;
    g.stroke();
    g.font = '800 14px ui-monospace, Menlo, Consolas, monospace';
    g.fillStyle = '#070a1c';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(n + 1), px, py + 1);
    g.textBaseline = 'alphabetic';
  });
}

function drawPods(g: CanvasRenderingContext2D, i: WorldLayerInput): void {
  const { world } = i;
  const cfg = world.tuning.rescue;
  const scale = i.screen.width / i.view.width;
  const mint = i.colors.mint;
  for (const pod of world.pods) {
    if (!pod.alive) continue;
    worldToScreen(p, pod.x, pod.y, i.center, i.view, i.screen);
    const body = progressRingRadius(cfg.podRadius, scale);
    const reach = rescueRingRadius(cfg.rescueRadius, scale);
    const margin = Math.max(body * 3, reach);
    if (
      p.x < -margin ||
      p.x > i.screen.width + margin ||
      p.y < -margin ||
      p.y > i.screen.height + margin
    )
      continue;

    // The beacon: rings that expand from the pod and fade.
    g.lineWidth = 2;
    for (let n = 0; n < BEACON_RINGS; n++) {
      const b = beaconRing(i.time, n);
      g.globalAlpha = b.alpha;
      g.strokeStyle = mint;
      g.beginPath();
      g.arc(p.x, p.y, body * b.scale, 0, Math.PI * 2);
      g.stroke();
    }
    g.globalAlpha = 1;

    // The rescue circle (how close you must be): a spinning dashed circle.
    g.save();
    g.setLineDash([10, 10]);
    g.lineDashOffset = -i.time * 24;
    g.strokeStyle = 'rgba(124, 240, 200, 0.45)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(p.x, p.y, reach, 0, Math.PI * 2);
    g.stroke();
    g.restore();

    // The progress ring with a glow.
    g.lineCap = 'round';
    g.strokeStyle = INK;
    g.lineWidth = 7;
    g.beginPath();
    g.arc(p.x, p.y, body, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = 'rgba(124, 240, 200, 0.35)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(p.x, p.y, body, 0, Math.PI * 2);
    g.stroke();
    if (pod.progress > 0) {
      glow(g, mint, 14);
      g.strokeStyle = mint;
      g.lineWidth = 5;
      g.beginPath();
      g.arc(p.x, p.y, body, -Math.PI / 2, progressEnd(pod.progress));
      g.stroke();
      noGlow(g);
    }

    // Hit-point pips and the label on a slanted plate.
    for (const dx of pipOffsets(pod.hp, pips)) {
      g.fillStyle = INK;
      g.fillRect(p.x + dx - 3.5, p.y + body + 8, 7, 7);
      g.fillStyle = mint;
      g.fillRect(p.x + dx - 2.5, p.y + body + 9, 5, 5);
    }
    const label = podLabel(pod.progress);
    g.font = FONT;
    const w = g.measureText(label).width + 22;
    plate(g, p.x, p.y - body - 16, w, 18, 4);
    g.fillStyle = 'rgba(8, 14, 30, 0.82)';
    g.fill();
    g.strokeStyle = mint;
    g.lineWidth = 1.5;
    g.stroke();
    g.fillStyle = mint;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(label, p.x, p.y - body - 15);
    g.textBaseline = 'alphabetic';
  }
}

/** Draws the world-anchored layer. The caller clears the canvas first. */
export function drawWorldLayer(g: CanvasRenderingContext2D, i: WorldLayerInput): void {
  if (i.dramatic) {
    drawAcquiring(g, i);
    drawLocked(g, i);
    drawPods(g, i);
  } else {
    g.font = '600 14px ui-monospace, Menlo, Consolas, monospace';
    drawLockRings(g, i.world, i.center, i.view, i.screen);
    drawPodRings(g, i.world, i.center, i.view, i.screen);
  }
  drawOrderMarker(g, i.world, i.center, i.view, i.screen);
}
