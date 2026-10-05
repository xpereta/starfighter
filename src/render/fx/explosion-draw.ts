import type { ExplosionDef } from '../style';
import { linearRgb, type TriBatch } from './tri-batch';

const BODY_SEGMENTS = 14;
const RING_SEGMENTS = 28;
/** Layers shrink away from the inside out: layer l is gone by this progress (0..1). */
const LAYER_GONE_BASE = 0.55;
const LAYER_GONE_STEP = 0.15;
const RING_MAX_TIME = 0.85;
/** The blast and its smoke fade towards the dark background over the last part of their life. */
const FADE_POWER = 2.2;

const ramps = new WeakMap<ExplosionDef, Float32Array>();

/** The def's colour ramp as linear RGB triples (cached per def). */
export function rampOf(def: ExplosionDef): Float32Array {
  let r = ramps.get(def);
  if (!r) {
    r = new Float32Array(def.ramp.length * 3);
    def.ramp.forEach((hex, i) => linearRgb(hex, r!, i * 3));
    ramps.set(def, r);
  }
  return r;
}

const out = [0, 0, 0];
const scratch = [0, 0, 0, 0];
/** Ramp colour at position `u` in 0..1 (0 = core, 1 = smoke), times `mul`. */
function colorAt(ramp: Float32Array, u: number, mul: number): number[] {
  const n = ramp.length / 3;
  const f = Math.min(1, Math.max(0, u)) * (n - 1);
  const i = Math.min(n - 2, Math.floor(f));
  const k = f - i;
  for (let c = 0; c < 3; c++)
    out[c] = (ramp[i * 3 + c]! * (1 - k) + ramp[(i + 1) * 3 + c]! * k) * mul;
  return out;
}

/**
 * Draws one explosion at progress `t` (0..1) into the batch: smoke puffs, shockwave ring, layered
 * hard-edged body that hollows out from the middle, starburst spikes and cross flare. `v0..v3` are
 * the roll's variation numbers (0..1). Pure drawing: no state, no allocation.
 */
export function drawExplosion(
  batch: TriBatch,
  def: ExplosionDef,
  x: number,
  y: number,
  size: number,
  t: number,
  rot: number,
  v0: number,
  v1: number,
  v2: number,
  v3: number,
): void {
  const ramp = rampOf(def);
  const grow = 1 - (1 - t) * (1 - t) * (1 - t);
  const fade = Math.max(0, 1 - Math.pow(t, FADE_POWER));
  const v = scratch;
  v[0] = v0;
  v[1] = v1;
  v[2] = v2;
  v[3] = v3;

  // Smoke: hard-edged puffs that drift out and outlast the flash.
  for (let i = 0; i < def.puffs; i++) {
    const a = rot + (i / def.puffs) * Math.PI * 2 + (v[i % 4]! - 0.5) * 1.1;
    const d = size * (0.45 + 0.75 * grow) * (0.6 + 0.4 * v[(i + 1) % 4]!);
    const r = size * 0.3 * (0.6 + 0.4 * v[(i + 2) % 4]!) * (0.35 + 0.65 * grow) * (1 - 0.4 * t);
    const c = colorAt(ramp, 1, Math.max(0, 1 - t * t * t));
    batch.disc(x + Math.cos(a) * d, y + Math.sin(a) * d, r, 8, a, c[0]!, c[1]!, c[2]!);
  }

  // Shockwave ring.
  if (def.ring > 0 && t < RING_MAX_TIME) {
    const k = t / RING_MAX_TIME;
    const radius = size * (0.35 + 1.1 * (1 - (1 - k) * (1 - k)));
    const thick = size * 0.09 * def.ring * (1 - k);
    const c = colorAt(ramp, 0.25, 1 - k * k);
    batch.ring(x, y, radius, thick, RING_SEGMENTS, c[0]!, c[1]!, c[2]!);
  }

  // Body: concentric flat discs, the inner ones shrinking away first.
  for (let l = 0; l < def.layers; l++) {
    const frac = 1 - l / (def.layers + 0.5);
    const gone = LAYER_GONE_BASE + LAYER_GONE_STEP * (def.layers - 1 - l);
    const alive = t >= gone ? 0 : 1 - Math.pow(t / gone, 3) * 0.6;
    const radius = size * grow * frac * (l === 0 ? 1 - 0.35 * t : alive);
    if (radius <= 0) continue;
    // Outer layers are cooler, the middle is the hot core; everything cools as it ages.
    const base = def.layers === 1 ? 0.25 : 0.5 * (1 - l / (def.layers - 1));
    const c = colorAt(ramp, base + 0.4 * t, l === 0 ? fade : 1);
    batch.disc(x, y, radius, BODY_SEGMENTS, rot, c[0]!, c[1]!, c[2]!);
  }

  // Starburst spikes.
  if (def.spikes > 0) {
    const c = colorAt(ramp, 0, fade);
    const len = size * (1.05 + 0.5 * v0) * grow;
    const half = size * 0.09 * (1 - t);
    for (let i = 0; i < def.spikes; i++) {
      const a = rot + (i / def.spikes) * Math.PI * 2;
      const l = len * (i % 2 === 0 ? 1 : 0.6 + 0.3 * v[i % 4]!);
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      batch.tri(
        x - sa * half,
        y + ca * half,
        x + sa * half,
        y - ca * half,
        x + ca * l,
        y + sa * l,
        c[0]!,
        c[1]!,
        c[2]!,
      );
    }
  }

  // Cross flare: two thin long diamonds.
  if (def.cross > 0) {
    const c = colorAt(ramp, 0, fade);
    const len = size * 1.5 * def.cross * grow;
    const half = size * 0.07 * (1 - t);
    for (let k = 0; k < 2; k++) {
      const a = rot + (k * Math.PI) / 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      batch.tri(
        x + ca * len,
        y + sa * len,
        x - sa * half,
        y + ca * half,
        x + sa * half,
        y - ca * half,
        c[0]!,
        c[1]!,
        c[2]!,
      );
      batch.tri(
        x - ca * len,
        y - sa * len,
        x - sa * half,
        y + ca * half,
        x + sa * half,
        y - ca * half,
        c[0]!,
        c[1]!,
        c[2]!,
      );
    }
  }
}

/** Most vertices one explosion can write (for sizing the batch). */
export function maxExplosionVertices(): number {
  const body = 3 * 14 * 3; // up to 3 layers
  const puffs = 8 * 8 * 3;
  const ring = 28 * 6;
  const spikes = 16 * 3;
  const cross = 4 * 3;
  return body + puffs + ring + spikes + cross;
}
