export const DEG = Math.PI / 180;
export const TAU = Math.PI * 2;

export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Wraps an angle to [-PI, PI]. */
export function wrapAngle(a: number): number {
  const r = a % TAU;
  return r > Math.PI ? r - TAU : r < -Math.PI ? r + TAU : r;
}
