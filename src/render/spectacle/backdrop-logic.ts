import type { BackdropDef, BackdropPalette, Structure } from '../spectacle-contract';

/** Pure parts of the living backdrop: the palette of each battle, easing between them, wrapping. */

/** Which palette a battle uses: practice mode and the start screen (battle 0) and battle 1 use the first, then they cycle. */
export function paletteIndex(battle: number, count: number): number {
  if (count <= 0) return 0;
  return battle <= 1 ? 0 : (battle - 1) % count;
}

const channel = (hex: number, shift: number): number => (hex >> shift) & 255;

/** Linear blend of two 0xRRGGBB colours. */
export function lerpHex(a: number, b: number, t: number): number {
  const k = Math.min(1, Math.max(0, t));
  const mix = (s: number): number =>
    Math.round(channel(a, s) + (channel(b, s) - channel(a, s)) * k) & 255;
  return (mix(16) << 16) | (mix(8) << 8) | mix(0);
}

/** Smooth ease in and out, 0..1. */
export const ease = (t: number): number => t * t * (3 - 2 * t);

export type PaletteColors = Pick<
  BackdropPalette,
  'sky' | 'nebulaA' | 'nebulaB' | 'star' | 'glow' | 'structureColor'
>;
const COLOR_KEYS = ['sky', 'nebulaA', 'nebulaB', 'star', 'glow', 'structureColor'] as const;

export interface PaletteBlend {
  /** The colours right now (eased between the old and the new palette). */
  readonly colors: PaletteColors;
  /** Opacity 0..1 of each far structure: the current battle's fades in, the old one out. */
  structureAlpha(kind: Structure): number;
  /** Index of the palette being moved to. */
  readonly target: number;
  step(dt: number, battle: number, def: BackdropDef): void;
}

/**
 * Eases the sky from one battle's palette to the next over `def.shift` seconds. The first step
 * jumps straight to the palette (no fade-in from nothing).
 */
export function createPaletteBlend(): PaletteBlend {
  const colors: PaletteColors = {
    sky: 0,
    nebulaA: 0,
    nebulaB: 0,
    star: 0,
    glow: 0,
    structureColor: 0,
  };
  const from: PaletteColors = { ...colors };
  const alpha: Record<Structure, number> = { none: 1, planet: 0, ring: 0, carrier: 0 };
  let target = -1;
  let t = 1;
  return {
    colors,
    structureAlpha: (kind) => alpha[kind],
    get target() {
      return target;
    },
    step(dt, battle, def) {
      const idx = Math.min(paletteIndex(battle, def.palettes.length), def.palettes.length - 1);
      const goal = def.palettes[idx]!;
      if (idx !== target) {
        const first = target < 0;
        target = idx;
        if (first) {
          for (const k of COLOR_KEYS) colors[k] = from[k] = goal[k];
          for (const s of Object.keys(alpha) as Structure[])
            alpha[s] = s === goal.structure ? 1 : 0;
          t = 1;
        } else {
          for (const k of COLOR_KEYS) from[k] = colors[k];
          t = 0;
        }
      }
      if (t < 1) {
        t = Math.min(1, t + dt / Math.max(def.shift, 0.05));
        const e = ease(t);
        for (const k of COLOR_KEYS) colors[k] = lerpHex(from[k], goal[k], e);
      }
      const rate = dt / Math.max(def.shift, 0.05);
      for (const s of Object.keys(alpha) as Structure[]) {
        const want = s === goal.structure ? 1 : 0;
        const a = alpha[s];
        alpha[s] = a < want ? Math.min(want, a + rate) : Math.max(want, a - rate);
      }
    },
  };
}

/**
 * Offset from the camera, in [-box/2, box/2), of a point that sits at fraction `u` of a wrapping
 * box and is shifted by `shift` (the parallax shift of its layer). The box is about the view size,
 * so the number of things on screen stays the same at any zoom.
 */
export function wrapOffset(u: number, shift: number, box: number): number {
  const f = u - shift / box + 0.5;
  return (f - Math.floor(f) - 0.5) * box;
}
