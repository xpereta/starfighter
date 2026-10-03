import type { ParamDef } from '../core/params/params';

/** Pure logic of the tuning panel (no DOM), so it can be unit-tested in Node. */

// Labels ---------------------------------------------------------------------------------

const LABEL_OVERRIDES: Record<string, string> = {
  evadeIFrames: 'Evade i-frames',
};

/** 'evadeCooldown' -> 'Evade cooldown'. */
export function labelOf(key: string): string {
  const override = LABEL_OVERRIDES[key];
  if (override) return override;
  const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// Steps and rounding -------------------------------------------------------------------------

/** Largest 1/2/5 x 10^k that is not above `x`. */
function niceFloor(x: number): number {
  const exp = Math.floor(Math.log10(x));
  const base = 10 ** exp;
  const m = x / base;
  const nice = m >= 5 ? 5 : m >= 2 ? 2 : 1;
  return nice * base;
}

/** Slider step: about 100 notches across the range, whole numbers for whole-number parameters. */
export function stepOf(def: ParamDef): number {
  if (def.step) return def.step;
  const raw = niceFloor((def.max - def.min) / 100);
  const whole = [def.default, def.min, def.max].every(Number.isInteger);
  return whole ? Math.max(1, raw) : raw;
}

/** Digits after the decimal point needed to show multiples of `step`. */
export function decimalsOf(step: number): number {
  const text = step.toString();
  if (text.includes('e-')) return Number(text.split('e-')[1]);
  const dot = text.indexOf('.');
  return dot < 0 ? 0 : text.length - dot - 1;
}

const toFixedNumber = (v: number, decimals: number): number => Number(v.toFixed(decimals));

/** Snaps a dragged value to the slider grid (grid starts at `min`), then clamps to the range. */
export function snapToStep(value: number, def: ParamDef): number {
  const step = stepOf(def);
  const snapped = def.min + Math.round((value - def.min) / step) * step;
  return clamp(toFixedNumber(snapped, decimalsOf(step)), def.min, def.max);
}

/** A typed value is only rounded to the displayed decimals, not snapped to the grid. */
export function roundTyped(value: number, def: ParamDef): number {
  return clamp(toFixedNumber(value, decimalsOf(stepOf(def))), def.min, def.max);
}

/** Text for a value: fixed decimals, then the short unit. */
export function formatValue(value: number, def: ParamDef): { number: string; unit: string } {
  return { number: value.toFixed(decimalsOf(stepOf(def))), unit: def.unit };
}

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** Fraction (0..1) of the range, for the fill bar. */
export function fractionOf(value: number, def: ParamDef): number {
  return clamp((value - def.min) / (def.max - def.min), 0, 1);
}

/** Value at a pointer position `fraction` (0..1) across the bar. */
export function valueAtFraction(fraction: number, def: ParamDef): number {
  return snapToStep(def.min + clamp(fraction, 0, 1) * (def.max - def.min), def);
}

// Cross-field relations ----------------------------------------------------------------------

/** `lo` must stay <= `hi` inside a tuning group. */
export interface Relation {
  group: string;
  lo: string;
  hi: string;
}

export const RELATIONS: readonly Relation[] = [
  { group: 'flight', lo: 'minSpeed', hi: 'cornerSpeed' },
  { group: 'flight', lo: 'cornerSpeed', hi: 'maxSpeed' },
  { group: 'flight', lo: 'minSpeed', hi: 'cruiseSpeed' },
  { group: 'flight', lo: 'cruiseSpeed', hi: 'maxSpeed' },
  { group: 'camera', lo: 'viewMin', hi: 'viewMax' },
  { group: 'arena', lo: 'droneSpeedMin', hi: 'droneSpeedMax' },
  { group: 'arena', lo: 'droneOrbitMin', hi: 'droneOrbitMax' },
  { group: 'arena', lo: 'staticSpawnMin', hi: 'staticSpawnMax' },
  { group: 'arena', lo: 'droneSpawnMin', hi: 'droneSpawnMax' },
  { group: 'arena', lo: 'turretSpawnMin', hi: 'turretSpawnMax' },
];

/** Clamps an edited value so every relation it takes part in still holds. The edited value moves, not its partner. */
export function clampToRelations(
  group: string,
  key: string,
  value: number,
  values: Readonly<Record<string, unknown>>,
): number {
  let v = value;
  for (const r of RELATIONS) {
    if (r.group !== group) continue;
    if (r.lo === key && typeof values[r.hi] === 'number') v = Math.min(v, values[r.hi] as number);
    if (r.hi === key && typeof values[r.lo] === 'number') v = Math.max(v, values[r.lo] as number);
  }
  return v;
}

// Changed values ---------------------------------------------------------------------------

export const isChanged = (value: unknown, defaultValue: unknown): boolean => value !== defaultValue;

// Colors and contrast --------------------------------------------------------------------------

export type Rgb = readonly [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** WCAG relative luminance. */
export function luminance([r, g, b]: Rgb): number {
  const lin = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio (1..21). */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** `fg` drawn at `alpha` over `bg`. */
export function composite(fg: Rgb, bg: Rgb, alpha: number): Rgb {
  return [0, 1, 2].map((i) => fg[i]! * alpha + bg[i]! * (1 - alpha)) as unknown as Rgb;
}
