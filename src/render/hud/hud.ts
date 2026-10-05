import { viewSize } from '../../core/camera/view';
import { livingWingmen } from '../../core/squadron/squadron';
import type { TargetKind } from '../../core/world/target';
import type { World } from '../../core/world/world';
import { lockLimit } from '../../core/lockon/lockon';
import { palette } from '../palette';
import { drawLockPanel, drawLockRings } from './locks-hud';
import { drawOrderMarker } from './order-marker';
import { drawMissileWarning } from './missile-warning-hud';
import { drawPodRings } from './pods-hud';
import { podDistanceLabel } from './pods';
import {
  blinkOn,
  createEdgeIndicator,
  distanceStyle,
  edgeIndicator,
  evadeReadiness,
  orderCueText,
  speedBar,
  squadronReadout,
  throttleState,
} from './layout';

const FONT = '600 14px ui-monospace, Menlo, Consolas, monospace';
/** Margin (px) of the canvas HUD text; the DOM run HUD (src/ui/hud-view.ts) lays out around its lines. */
export const PAD = 24;
const BAR_W = 220;
const BAR_H = 10;
const EVADE_W = 120;
const EVADE_H = 6;

const css = (hex: number): string => `#${hex.toString(16).padStart(6, '0')}`;
const FIGHTER_COLOR = css(palette.fighter);
const WINGMAN_COLOR = css(palette.wingman);
const POD_COLOR = css(palette.pod);
const KIND_COLOR: Record<TargetKind, string> = {
  static: css(palette.enemyStatic),
  drone: css(palette.enemy),
  turret: css(palette.turret),
};

export interface Hud {
  draw(world: World): void;
  dispose(): void;
}

/** 2D canvas overlay. All placement math lives in layout.ts; this file only draws. */
export function createHud(container: HTMLElement): Hud {
  const canvas = document.createElement('canvas');
  canvas.id = 'hud';
  // Explicit CSS size: a canvas ignores inset and would otherwise show at its pixel size (2x on Retina).
  canvas.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas is not available for the HUD');
  const g = ctx;
  const indicator = createEdgeIndicator();
  const screen = { width: 0, height: 0 };

  function resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    screen.width = window.innerWidth;
    screen.height = window.innerHeight;
    canvas.width = Math.round(screen.width * dpr);
    canvas.height = Math.round(screen.height * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  function text(
    s: string,
    x: number,
    y: number,
    color: string,
    align: CanvasTextAlign = 'left',
  ): void {
    g.fillStyle = color;
    g.textAlign = align;
    g.fillText(s, x, y);
  }

  function drawEdgeArrows(world: World): void {
    const cam = world.camera;
    const view = viewSize(cam.view, cam.aspect);
    const center = { x: cam.x + cam.shakeX, y: cam.y + cam.shakeY };
    const cfg = world.tuning.hud;
    const arrow = (
      t: { x: number; y: number; radius: number },
      color: string,
      shape: 'plain' | 'notched' | 'outline' | 'diamond',
      label?: (distance: number) => string,
    ): void => {
      if (!edgeIndicator(indicator, t, center, view, screen, cfg.edgeMargin)) return;
      const { size, opacity } = distanceStyle(indicator.distance, cfg);
      g.save();
      g.translate(indicator.x, indicator.y);
      g.rotate(indicator.angle);
      g.globalAlpha = opacity;
      g.fillStyle = color;
      g.strokeStyle = color;
      g.lineWidth = 2;
      g.beginPath();
      if (shape === 'outline') {
        // Wingmen: a smaller hollow triangle, so friends are told from enemies by shape and not only by color.
        const s = size * 0.8;
        g.moveTo(s, 0);
        g.lineTo(-s * 0.6, s * 0.65);
        g.lineTo(-s * 0.6, -s * 0.65);
      } else if (shape === 'diamond') {
        // Rescue pods: a diamond with its distance, unlike every enemy and wingman arrow.
        const s = size * 0.9;
        g.moveTo(s, 0);
        g.lineTo(0, s * 0.7);
        g.lineTo(-s * 0.7, 0);
        g.lineTo(0, -s * 0.7);
      } else if (shape === 'notched') {
        // Enemy fighters: a larger arrow with a notched tail, so they read apart from drones and turrets.
        const s = size * 1.25;
        g.moveTo(s, 0);
        g.lineTo(-s * 0.7, s * 0.8);
        g.lineTo(-s * 0.25, 0);
        g.lineTo(-s * 0.7, -s * 0.8);
      } else {
        g.moveTo(size, 0);
        g.lineTo(-size * 0.6, size * 0.65);
        g.lineTo(-size * 0.6, -size * 0.65);
      }
      g.closePath();
      if (shape === 'outline') g.stroke();
      else g.fill();
      g.restore();
      if (label) {
        // The label sits just inside the arrow, toward the middle of the screen.
        g.globalAlpha = 1;
        g.font = '700 11px ui-monospace, Menlo, Consolas, monospace';
        g.textAlign = 'center';
        g.fillStyle = color;
        g.fillText(
          label(indicator.distance),
          indicator.x - Math.cos(indicator.angle) * 52,
          indicator.y - Math.sin(indicator.angle) * 24,
        );
      }
    };
    for (const t of world.targets) if (t.alive) arrow(t, KIND_COLOR[t.kind], 'plain');
    for (const f of world.fighters) if (f.alive) arrow(f, FIGHTER_COLOR, 'notched');
    for (const pod of world.pods) {
      if (pod.alive) {
        const podBody = { x: pod.x, y: pod.y, radius: world.tuning.rescue.podRadius };
        arrow(podBody, POD_COLOR, 'diamond', podDistanceLabel);
      }
    }
    const wingmanBody = { x: 0, y: 0, radius: world.tuning.squadron.radius };
    for (const w of world.squadron.wingmen) {
      if (!w.alive) continue;
      wingmanBody.x = w.ship.x;
      wingmanBody.y = w.ship.y;
      arrow(wingmanBody, WINGMAN_COLOR, 'outline');
    }
  }

  const lockCenter = { x: 0, y: 0 };
  function drawLocks(world: World): void {
    const cam = world.camera;
    lockCenter.x = cam.x + cam.shakeX;
    lockCenter.y = cam.y + cam.shakeY;
    const view = viewSize(cam.view, cam.aspect);
    drawLockRings(g, world, lockCenter, view, screen);
    drawOrderMarker(g, world, lockCenter, view, screen);
    drawPodRings(g, world, lockCenter, view, screen);
    drawMissileWarning(g, world, lockCenter, view, screen);
    drawLockPanel(g, world, lockLimit(world), screen.height);
  }

  function drawFlight(world: World): void {
    const { ship, tuning, actions } = world;
    const flight = tuning.flight;
    const bar = speedBar(ship.speed, flight);
    const left = PAD;
    const base = screen.height - PAD;

    // Evade cooldown.
    const ready = evadeReadiness(ship.evadeCooldown, flight.evadeCooldown);
    const evadeY = base - EVADE_H;
    g.fillStyle = 'rgba(255,255,255,0.15)';
    g.fillRect(left, evadeY, EVADE_W, EVADE_H);
    g.fillStyle = ready >= 1 ? css(palette.friendly) : css(palette.enemyStatic);
    g.fillRect(left, evadeY, EVADE_W * ready, EVADE_H);
    text(
      ready >= 1 ? 'EVADE READY' : 'EVADE',
      left + EVADE_W + 10,
      evadeY + EVADE_H + 2,
      'rgba(255,255,255,0.8)',
    );

    // Speed bar with min (start), corner, cruise and max (end) markers.
    const barY = evadeY - 22;
    g.fillStyle = 'rgba(255,255,255,0.15)';
    g.fillRect(left, barY, BAR_W, BAR_H);
    g.fillStyle = css(palette.friendly);
    g.fillRect(left, barY, BAR_W * bar.fill, BAR_H);
    g.fillStyle = '#ffffff';
    g.fillRect(left + BAR_W * bar.corner - 1, barY - 4, 2, BAR_H + 8); // corner speed: tightest turns
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.fillRect(left + BAR_W * bar.cruise - 1, barY - 2, 2, BAR_H + 4);
    g.fillRect(left, barY - 2, 2, BAR_H + 4);
    g.fillRect(left + BAR_W - 2, barY - 2, 2, BAR_H + 4);
    text(
      `SPEED ${Math.round(ship.speed)}  ${throttleState(actions.throttle, flight.throttleDeadband)}`,
      left,
      barY - 10,
      'rgba(255,255,255,0.85)',
    );
  }

  function drawStatus(world: World): void {
    const { trial, stats, ship, tuning } = world;
    const best = trial.best === null ? '--' : `${trial.best.toFixed(1)}s`;
    text(
      `KILLS ${stats.kills}   HITS TAKEN ${stats.hitsTaken}`,
      PAD,
      PAD + 10,
      'rgba(255,255,255,0.8)',
    );
    // Squadron: the formation and wingman count always (when there are wingmen); the order only while active.
    const squad = squadronReadout(
      world.squadron,
      livingWingmen(world.squadron),
      world.squadron.wingmen.length,
    );
    if (squad) {
      text(
        `WINGMEN ${squad.wingmen}   ${squad.formation}`,
        PAD,
        PAD + 30,
        'rgba(125,255,176,0.75)',
      );
      if (squad.order) text(`ORDER: ${squad.order}`, PAD, PAD + 50, WINGMAN_COLOR);
    }
    // A press that could not act says why, even with no wingmen (when the readout above is hidden).
    const cue = orderCueText(world.squadron);
    if (cue && blinkOn(world.time, tuning.hud.warningBlinkHz)) {
      text(cue, PAD, PAD + 50, css(palette.enemyStatic));
    }
    if (trial.active) {
      let alive = 0;
      let total = 0;
      for (const t of world.targets) {
        if (t.kind !== 'drone') continue;
        total++;
        if (t.alive) alive++;
      }
      text(
        `TRIAL ${trial.time.toFixed(1)}s   DRONES ${alive}/${total}   BEST ${best}`,
        screen.width / 2,
        PAD + 10,
        css(palette.projectile),
        'center',
      );
    } else {
      const last = trial.last === null ? '' : `   LAST ${trial.last.toFixed(1)}s`;
      text(
        `T: TIME TRIAL   BEST ${best}${last}`,
        screen.width / 2,
        PAD + 10,
        'rgba(255,255,255,0.6)',
        'center',
      );
    }
    if (ship.outside && blinkOn(world.time, tuning.hud.warningBlinkHz)) {
      text('RETURN TO ARENA', screen.width / 2, PAD + 50, css(palette.enemy), 'center');
    }
  }

  return {
    draw(world) {
      g.clearRect(0, 0, screen.width, screen.height);
      g.font = FONT;
      g.textBaseline = 'alphabetic';
      drawEdgeArrows(world);
      drawLocks(world);
      drawFlight(world);
      drawStatus(world);
    },
    dispose() {
      window.removeEventListener('resize', resize);
      canvas.remove();
    },
  };
}
