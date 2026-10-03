import { viewSize } from '../core/camera/view';
import { turnRateLimit } from '../core/flight/flight';
import { DEG } from '../core/math';
import type { World } from '../core/world/world';
import { worldToScreen } from '../render/hud/layout';

const FONT = '12px ui-monospace, Menlo, Consolas, monospace';
const CHART_W = 180;
const CHART_H = 90;
const VECTOR_PX = 120;
const FRAME_EMA = 0.1; // smoothing for the FPS readout

export interface DebugOverlay {
  /** Draws when `enabled`; always call once per frame so frame timing stays current. */
  draw(world: World, frameSeconds: number, enabled: boolean): void;
  dispose(): void;
}

/** Debug overlay: vectors, turn-rate curve, camera target and safe frame, hit circles, timing, counts. */
export function createDebugOverlay(container: HTMLElement): DebugOverlay {
  const canvas = document.createElement('canvas');
  canvas.id = 'debug-overlay';
  canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas is not available for the debug overlay');
  const g = ctx;
  const screen = { width: 0, height: 0 };
  const p = { x: 0, y: 0 };
  let frameMs = 16.7;

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

  function line(x1: number, y1: number, x2: number, y2: number, color: string): void {
    g.strokeStyle = color;
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.stroke();
  }

  function circle(x: number, y: number, r: number, color: string): void {
    g.strokeStyle = color;
    g.beginPath();
    g.arc(x, y, Math.max(r, 1), 0, Math.PI * 2);
    g.stroke();
  }

  function drawTurnChart(world: World): void {
    const cfg = world.tuning.flight;
    const x0 = screen.width / 2 - CHART_W / 2;
    const y0 = screen.height - CHART_H - 20;
    const top = turnRateLimit(cfg, cfg.cornerSpeed) * 1.15;
    const sx = (speed: number): number =>
      x0 + ((speed - cfg.minSpeed) / (cfg.maxSpeed - cfg.minSpeed)) * CHART_W;
    const sy = (rate: number): number => y0 + CHART_H - (rate / top) * CHART_H;
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fillRect(x0 - 6, y0 - 18, CHART_W + 12, CHART_H + 24);
    g.strokeStyle = 'rgba(255,255,255,0.6)';
    g.beginPath();
    for (let i = 0; i <= 40; i++) {
      const speed = cfg.minSpeed + ((cfg.maxSpeed - cfg.minSpeed) * i) / 40;
      const x = sx(speed);
      const y = sy(turnRateLimit(cfg, speed));
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
    const speed = world.ship.speed;
    g.fillStyle = '#ffd24a';
    g.beginPath();
    g.arc(sx(speed), sy(turnRateLimit(cfg, speed)), 4, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.textAlign = 'left';
    g.fillText(
      `turn ${(turnRateLimit(cfg, speed) / DEG).toFixed(0)} deg/s @ ${speed.toFixed(0)}`,
      x0 - 2,
      y0 - 6,
    );
  }

  return {
    draw(world, frameSeconds, enabled) {
      frameMs += (frameSeconds * 1000 - frameMs) * FRAME_EMA;
      g.clearRect(0, 0, screen.width, screen.height);
      if (!enabled) return;
      g.font = FONT;
      g.lineWidth = 1.5;
      const cam = world.camera;
      const view = viewSize(cam.view, cam.aspect);
      const center = { x: cam.x + cam.shakeX, y: cam.y + cam.shakeY };
      const scale = screen.width / view.width;
      const { ship } = world;

      // Safe frame: the ship must stay inside this inset rectangle.
      const mx = screen.width * world.tuning.camera.safeFrame;
      const my = screen.height * world.tuning.camera.safeFrame;
      g.strokeStyle = 'rgba(255,210,74,0.6)';
      g.setLineDash([6, 6]);
      g.strokeRect(mx, my, screen.width - 2 * mx, screen.height - 2 * my);
      g.setLineDash([]);

      // Camera center (cross).
      line(
        screen.width / 2 - 8,
        screen.height / 2,
        screen.width / 2 + 8,
        screen.height / 2,
        '#ffd24a',
      );
      line(
        screen.width / 2,
        screen.height / 2 - 8,
        screen.width / 2,
        screen.height / 2 + 8,
        '#ffd24a',
      );

      // Hit circles.
      for (const t of world.targets) {
        if (!t.alive) continue;
        worldToScreen(p, t.x, t.y, center, view, screen);
        circle(p.x, p.y, t.radius * scale, 'rgba(255,90,95,0.8)');
      }
      for (let i = 0; i < world.bullets.count; i++) {
        worldToScreen(p, world.bullets.data.x[i]!, world.bullets.data.y[i]!, center, view, screen);
        circle(p.x, p.y, world.tuning.weapons.bulletRadius * scale, 'rgba(255,242,122,0.7)');
      }
      for (let i = 0; i < world.enemyShots.count; i++) {
        worldToScreen(
          p,
          world.enemyShots.data.x[i]!,
          world.enemyShots.data.y[i]!,
          center,
          view,
          screen,
        );
        circle(p.x, p.y, world.tuning.arena.enemyShotRadius * scale, 'rgba(255,143,176,0.8)');
      }
      worldToScreen(p, ship.x, ship.y, center, view, screen);
      circle(
        p.x,
        p.y,
        world.tuning.arena.playerRadius * scale,
        ship.invulnerable ? '#ffffff' : '#4ee1ff',
      );

      // Nose (cyan) vs velocity (green): the gap is the slide.
      const shipX = p.x;
      const shipY = p.y;
      line(
        shipX,
        shipY,
        shipX + Math.cos(ship.heading) * VECTOR_PX,
        shipY - Math.sin(ship.heading) * VECTOR_PX,
        '#4ee1ff',
      );
      const speedFrac = ship.speed / world.tuning.flight.maxSpeed;
      const vLen = Math.hypot(ship.vx, ship.vy) || 1;
      line(
        shipX,
        shipY,
        shipX + (ship.vx / vLen) * VECTOR_PX * speedFrac,
        shipY - (ship.vy / vLen) * VECTOR_PX * speedFrac,
        '#7dff7d',
      );

      drawTurnChart(world);

      const alive = world.targets.filter((t) => t.alive).length;
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.textAlign = 'center';
      const lines = [
        `${(1000 / frameMs).toFixed(0)} fps  ${frameMs.toFixed(1)} ms`,
        `bullets ${world.bullets.count}/${world.bullets.capacity}`,
        `enemy shots ${world.enemyShots.count}/${world.enemyShots.capacity}`,
        `targets ${alive}/${world.targets.length}`,
        `tick ${world.tick}`,
      ];
      lines.forEach((text, i) =>
        g.fillText(
          text,
          screen.width / 2,
          screen.height - CHART_H - 50 - (lines.length - 1 - i) * 16,
        ),
      );
    },
    dispose() {
      window.removeEventListener('resize', resize);
      canvas.remove();
    },
  };
}
