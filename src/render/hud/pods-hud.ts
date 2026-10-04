import type { World } from '../../core/world/world';
import { palette } from '../palette';
import { worldToScreen } from './layout';
import { pipOffsets, podLabel, progressEnd, progressRingRadius, rescueRingRadius } from './pods';

/** Drawing for rescue pods: the rescue circle, the progress ring, hit-point pips and a label. Placement lives in pods.ts. */

const COLOR = `#${palette.pod.toString(16).padStart(6, '0')}`;
const OUTLINE = 'rgba(0,0,0,0.6)';
const PIP_RADIUS = 2.5;
const FAINT = 'rgba(154,216,255,0.35)';

const p = { x: 0, y: 0 };
const pips: number[] = [];

/** Rings and labels on every living pod that is on screen. */
export function drawPodRings(
  g: CanvasRenderingContext2D,
  world: World,
  center: { x: number; y: number },
  view: { width: number; height: number },
  screen: { width: number; height: number },
): void {
  const cfg = world.tuning.rescue;
  const scale = screen.width / view.width;
  g.lineCap = 'round';
  for (const pod of world.pods) {
    if (!pod.alive) continue;
    worldToScreen(p, pod.x, pod.y, center, view, screen);
    const ring = progressRingRadius(cfg.podRadius, scale);
    const reach = rescueRingRadius(cfg.rescueRadius, scale);
    const margin = Math.max(ring, reach);
    if (
      p.x < -margin ||
      p.x > screen.width + margin ||
      p.y < -margin ||
      p.y > screen.height + margin
    ) {
      continue;
    }

    // How close you must be: a faint dashed circle.
    g.lineWidth = 1.5;
    g.strokeStyle = FAINT;
    g.setLineDash([8, 8]);
    g.beginPath();
    g.arc(p.x, p.y, reach, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);

    // The progress ring: a faint full ring, and the filled part clockwise from 12 o'clock.
    g.lineWidth = 5;
    g.strokeStyle = OUTLINE;
    g.beginPath();
    g.arc(p.x, p.y, ring, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 2;
    g.strokeStyle = FAINT;
    g.beginPath();
    g.arc(p.x, p.y, ring, 0, Math.PI * 2);
    g.stroke();
    if (pod.progress > 0) {
      const end = progressEnd(pod.progress);
      g.lineWidth = 7;
      g.strokeStyle = OUTLINE;
      g.beginPath();
      g.arc(p.x, p.y, ring, -Math.PI / 2, end);
      g.stroke();
      g.lineWidth = 4;
      g.strokeStyle = COLOR;
      g.beginPath();
      g.arc(p.x, p.y, ring, -Math.PI / 2, end);
      g.stroke();
    }

    // Hit points as pips under the pod: what enemy fire has left of it.
    for (const dx of pipOffsets(pod.hp, pips)) {
      g.fillStyle = OUTLINE;
      g.beginPath();
      g.arc(p.x + dx, p.y + ring + 12, PIP_RADIUS + 1.5, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = COLOR;
      g.beginPath();
      g.arc(p.x + dx, p.y + ring + 12, PIP_RADIUS, 0, Math.PI * 2);
      g.fill();
    }

    g.font = '700 12px ui-monospace, Menlo, Consolas, monospace';
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.lineWidth = 3;
    g.strokeStyle = OUTLINE;
    g.strokeText(podLabel(pod.progress), p.x, p.y - ring - 8);
    g.fillStyle = COLOR;
    g.fillText(podLabel(pod.progress), p.x, p.y - ring - 8);
  }
}
