import { clamp, lerp, TAU } from '../../core/math';
import { easeOutCubic } from './anim';

/**
 * Geometry and timing for the dramatic lock reticles and the rescue beacon. Pure numbers, so the
 * drawing code (`world-layer.ts`) stays a thin layer over tested helpers.
 */

/** Distance of the reticle brackets from the target centre, in ring radii: wide at the start, snapped onto the ring at lock. */
export const BRACKET_FAR = 2.7;
export const BRACKET_NEAR = 1.18;

/** Where the corner brackets sit while a lock fills (`progress` 0..1): they close in on the target. */
export function bracketDistance(ringRadius: number, progress: number): number {
  return ringRadius * lerp(BRACKET_FAR, BRACKET_NEAR, easeOutCubic(clamp(progress, 0, 1)));
}

/** Spin of the dashed ring: fast while acquiring, slow once locked. Radians at time `t` seconds. */
export function reticleSpin(t: number, locked: boolean): number {
  return (t * (locked ? 0.9 : 3.2)) % TAU;
}

/** The expanding pulse ring after a lock lands (`age` seconds since LockAcquired): radius multiplier and opacity. */
export const PULSE_SECONDS = 0.6;
export function lockPulse(age: number): { scale: number; alpha: number } {
  const k = clamp(age / PULSE_SECONDS, 0, 1);
  return { scale: lerp(1, 2.6, easeOutCubic(k)), alpha: 1 - k };
}

/** A beacon ring expands from the pod and fades; `phase` 0..1 repeats every `BEACON_SECONDS`. */
export const BEACON_SECONDS = 1.6;
export const BEACON_RINGS = 3;
export function beaconRing(t: number, index: number): { scale: number; alpha: number } {
  const phase = (t / BEACON_SECONDS + index / BEACON_RINGS) % 1;
  return { scale: lerp(0.6, 2.8, phase), alpha: (1 - phase) * 0.8 };
}

/** The four corners of a bracket frame: signs of x and y. */
export const CORNERS: readonly (readonly [number, number])[] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];

/** Arm length of a corner bracket for a given half-size. */
export function armLength(half: number): number {
  return Math.max(6, half * 0.42);
}
