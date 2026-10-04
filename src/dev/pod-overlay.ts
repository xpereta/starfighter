import type { World } from '../core/world/world';
import { worldToScreen } from '../render/hud/layout';

/** Debug drawing for rescue pods: the rescue radius, the enemy threat range and the progress as text. */

const RESCUE_COLOR = 'rgba(154,216,255,0.8)';
const THREAT_COLOR = 'rgba(255,90,95,0.45)';

const p = { x: 0, y: 0 };

export function drawPodDebug(
  g: CanvasRenderingContext2D,
  world: World,
  center: { x: number; y: number },
  view: { width: number; height: number },
  screen: { width: number; height: number },
): void {
  const cfg = world.tuning.rescue;
  const scale = screen.width / view.width;
  g.lineWidth = 1.5;
  g.font = '11px ui-monospace, Menlo, Consolas, monospace';
  g.textAlign = 'left';
  for (const pod of world.pods) {
    if (!pod.alive) continue;
    worldToScreen(p, pod.x, pod.y, center, view, screen);
    g.setLineDash([4, 6]);
    g.strokeStyle = THREAT_COLOR;
    g.beginPath();
    g.arc(p.x, p.y, cfg.podThreatRange * scale, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);
    g.strokeStyle = RESCUE_COLOR;
    g.beginPath();
    g.arc(p.x, p.y, cfg.rescueRadius * scale, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = RESCUE_COLOR;
    g.fillText(
      `pod hp ${pod.hp}/${cfg.podHealth}  rescue ${Math.round(pod.progress * 100)}%  pilot #${pod.pilotId}`,
      p.x + 14,
      p.y + 4,
    );
  }
}
