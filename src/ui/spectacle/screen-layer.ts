import { palette } from '../../render/palette';
import type { FeelOutput } from './feel';
import type { Indicator, IndicatorKind } from './indicators';
import type { UiColors } from './presentation';

/**
 * The screen-space overlay of the spectacle layer: off-screen indicators with distance and threats,
 * the tension and damage vignettes, the flash, and the kill-cam's speed lines and letterbox bars.
 * Not transformed with the world (a punch or roll must not push the arrows off the screen edge).
 */

const FONT = '700 11px ui-monospace, Menlo, Consolas, monospace';
const INK = 'rgba(4, 6, 20, 0.8)';
const css = (hex: number): string => `#${hex.toString(16).padStart(6, '0')}`;

export interface ScreenLayerInput {
  screen: { width: number; height: number };
  /** Wall-clock seconds (animation only). */
  time: number;
  feel: FeelOutput;
  indicators: readonly Indicator[];
  /** Whether to draw the indicators (the `indicators` switch). */
  showIndicators: boolean;
  colors: UiColors;
}

const hash = (n: number): number => {
  let h = Math.imul(n | 0, 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
};

function kindColor(kind: IndicatorKind, colors: UiColors): string {
  switch (kind) {
    case 'fighter':
      return css(palette.fighter);
    case 'drone':
      return css(palette.enemy);
    case 'turret':
      return css(palette.turret);
    case 'static':
      return css(palette.enemyStatic);
    case 'wingman':
      return css(palette.wingman);
    case 'pod':
      return colors.mint;
  }
}

function shape(g: CanvasRenderingContext2D, kind: IndicatorKind, s: number): void {
  g.beginPath();
  switch (kind) {
    case 'fighter': {
      // A big arrow with a notched tail and a second chevron: the heavy hitter.
      const k = s * 1.3;
      g.moveTo(k, 0);
      g.lineTo(-k * 0.7, k * 0.8);
      g.lineTo(-k * 0.25, 0);
      g.lineTo(-k * 0.7, -k * 0.8);
      break;
    }
    case 'turret': {
      // A hexagon-ish plate.
      g.moveTo(s, 0);
      g.lineTo(s * 0.3, s * 0.8);
      g.lineTo(-s * 0.7, s * 0.8);
      g.lineTo(-s * 0.7, -s * 0.8);
      g.lineTo(s * 0.3, -s * 0.8);
      break;
    }
    case 'static': {
      g.moveTo(s * 0.7, 0);
      g.lineTo(0, s * 0.5);
      g.lineTo(-s * 0.7, 0);
      g.lineTo(0, -s * 0.5);
      break;
    }
    case 'wingman': {
      const k = s * 0.9;
      g.moveTo(k, 0);
      g.lineTo(-k * 0.6, k * 0.7);
      g.lineTo(-k * 0.25, 0);
      g.lineTo(-k * 0.6, -k * 0.7);
      break;
    }
    case 'pod': {
      const k = s;
      g.moveTo(k, 0);
      g.lineTo(0, k * 0.75);
      g.lineTo(-k * 0.75, 0);
      g.lineTo(0, -k * 0.75);
      break;
    }
    default: {
      g.moveTo(s, 0);
      g.lineTo(-s * 0.6, s * 0.65);
      g.lineTo(-s * 0.6, -s * 0.65);
    }
  }
  g.closePath();
}

function drawIndicator(
  g: CanvasRenderingContext2D,
  ind: Indicator,
  time: number,
  colors: UiColors,
): void {
  const color = ind.threat ? colors.hot : kindColor(ind.kind, colors);
  const pulse = ind.threat ? 0.75 + 0.25 * Math.sin(time * 14) : 1;
  const size =
    ind.size * (ind.threat ? 1.35 : 1) * (ind.kind === 'pod' ? 1 + 0.1 * Math.sin(time * 6) : 1);
  g.save();
  g.translate(ind.x, ind.y);
  g.rotate(ind.angle);
  g.globalAlpha = ind.opacity * pulse;
  g.shadowColor = color;
  g.shadowBlur = ind.threat ? 16 : 8;
  shape(g, ind.kind, size);
  if (ind.kind === 'wingman') {
    g.lineWidth = 2.5;
    g.strokeStyle = color;
    g.stroke();
  } else {
    g.fillStyle = color;
    g.fill();
    g.shadowBlur = 0;
    g.lineWidth = 1.5;
    g.strokeStyle = INK;
    g.stroke();
  }
  g.restore();

  // The threat ring: a pulsing hollow circle behind the arrow.
  if (ind.threat) {
    g.save();
    g.globalAlpha = 0.8 * pulse;
    g.strokeStyle = colors.hot;
    g.lineWidth = 2;
    g.beginPath();
    g.arc(ind.x, ind.y, size * 1.5 + 4 * Math.sin(time * 9), 0, Math.PI * 2);
    g.stroke();
    g.restore();
  }

  // The label sits just inside the arrow, toward the middle of the screen: distance (and the callsign).
  g.save();
  g.globalAlpha = Math.max(0.6, ind.opacity);
  g.font = FONT;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const lx = ind.x - Math.cos(ind.angle) * (size + 26);
  const ly = ind.y - Math.sin(ind.angle) * (size + 14);
  const text = ind.tag ? `${ind.tag.toUpperCase()} ${ind.label}` : ind.label;
  g.lineWidth = 3;
  g.strokeStyle = INK;
  g.strokeText(text, lx, ly);
  g.fillStyle = color;
  g.fillText(text, lx, ly);
  g.restore();
}

function vignette(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  rgb: string,
  alpha: number,
): void {
  if (alpha <= 0.005) return;
  const r = Math.hypot(w, h) / 2;
  const grad = g.createRadialGradient(w / 2, h / 2, r * 0.45, w / 2, h / 2, r);
  grad.addColorStop(0, `rgba(${rgb}, 0)`);
  grad.addColorStop(1, `rgba(${rgb}, ${Math.min(0.85, alpha)})`);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
}

/** How strong the speed lines draw (subdued: they were too visible). */
const SPEED_LINE_OPACITY = 0.3;

/** Radial speed lines from the middle of the screen outward; they re-roll 18 times a second like drawn frames. */
function speedLines(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  time: number,
  amount: number,
  color: string,
): void {
  if (amount <= 0.01) return;
  const frame = Math.floor(time * 18);
  const r = Math.hypot(w, h) / 2;
  const count = 70;
  g.save();
  g.translate(w / 2, h / 2);
  g.strokeStyle = color;
  g.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const a = hash(i * 7 + frame * 131) * Math.PI * 2;
    const r0 = r * (0.3 + 0.45 * hash(i * 13 + frame * 17));
    const r1 = r * (0.95 + 0.25 * hash(i * 29 + frame * 3));
    g.globalAlpha = SPEED_LINE_OPACITY * amount * (0.35 + 0.65 * hash(i * 5 + frame));
    g.lineWidth = 1 + 1.6 * hash(i * 11 + frame * 7) * amount;
    g.beginPath();
    g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
    g.stroke();
  }
  g.restore();
}

/** The kill-cam's letterbox bars and its slanted call-out. `k` runs 1 -> 0 over the freeze. */
function killCam(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  k: number,
  kills: number,
  colors: UiColors,
): void {
  const env = Math.min(1, (1 - k) * 9, k * 9);
  const bar = h * 0.11 * env;
  g.fillStyle = '#02030a';
  g.fillRect(0, 0, w, bar);
  g.fillRect(0, h - bar, w, bar);
  // A hard diagonal accent in the bars.
  g.fillStyle = colors.hot;
  g.fillRect(0, bar - 3, w * 0.35 * env, 3);
  g.fillRect(w - w * 0.35 * env, h - bar, w * 0.35 * env, 3);

  const x = w * 0.5 + (1 - env) * w * 0.4;
  const y = h * 0.5;
  g.save();
  g.translate(x, y);
  g.transform(1, 0, -0.28, 1, 0, 0); // skew like a title card
  g.font = `900 ${Math.round(Math.min(w * 0.08, 96))}px ui-sans-serif, system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'miter';
  g.lineWidth = 10;
  g.strokeStyle = colors.hot;
  g.strokeText(`${kills} KILLS`, 0, 0);
  g.fillStyle = '#ffffff';
  g.fillText(`${kills} KILLS`, 0, 0);
  g.font = '800 18px ui-monospace, Menlo, Consolas, monospace';
  g.fillStyle = colors.gold;
  g.fillText('MISSILE SALVO', 0, Math.min(w * 0.05, 64));
  g.restore();
}

/** Draws the screen-space layer. The caller clears the canvas first. */
export function drawScreenLayer(g: CanvasRenderingContext2D, i: ScreenLayerInput): void {
  const { width: w, height: h } = i.screen;
  const f = i.feel;

  if (i.showIndicators) {
    for (const ind of i.indicators) drawIndicator(g, ind, i.time, i.colors);
  }

  vignette(g, w, h, '255, 40, 80', f.vignette * 0.75);
  vignette(g, w, h, '255, 20, 60', f.damage * 0.8);

  if (f.killCam > 0) {
    // Gunbuster-style frame: the world darkens a touch and white speed lines burst from the centre.
    g.fillStyle = `rgba(2, 3, 10, ${0.28 * f.killCam})`;
    g.fillRect(0, 0, w, h);
  }
  speedLines(g, w, h, i.time, f.speedFlash, '#ffffff');
  if (f.killCam > 0) killCam(g, w, h, f.killCam, f.killCamKills, i.colors);

  if (f.flash > 0.01) {
    g.fillStyle = `rgba(255, 255, 255, ${Math.min(0.6, f.flash * 0.6)})`;
    g.fillRect(0, 0, w, h);
  }
}
