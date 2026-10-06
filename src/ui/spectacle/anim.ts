import { clamp } from '../../core/math';

/** Easing and slide timelines shared by the spectacle views. Pure, so they are unit-tested. */

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
export const easeInCubic = (t: number): number => Math.pow(clamp(t, 0, 1), 3);
/** Overshoots a little then settles: the "snap" of a panel arriving. */
export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const x = clamp(t, 0, 1) - 1;
  return 1 + c3 * x * x * x + c1 * x * x;
}

export interface Slide {
  /** 1 = fully off screen (before it arrives and after it leaves), 0 = in place. */
  off: number;
  /** 0..1. */
  alpha: number;
  phase: 'in' | 'hold' | 'out' | 'done';
}

/**
 * A thing that slides in over `inTime`, holds for `hold`, slides out over `outTime` (all seconds),
 * at `age` seconds after it appeared.
 */
export function slide(age: number, inTime: number, hold: number, outTime: number): Slide {
  if (age < 0) return { off: 1, alpha: 0, phase: 'in' };
  if (age < inTime) {
    const k = age / inTime;
    return { off: 1 - easeOutCubic(k), alpha: Math.min(1, k * 2), phase: 'in' };
  }
  if (age < inTime + hold) return { off: 0, alpha: 1, phase: 'hold' };
  const out = age - inTime - hold;
  if (out < outTime) {
    const k = out / outTime;
    return { off: easeInCubic(k), alpha: 1 - k, phase: 'out' };
  }
  return { off: 1, alpha: 0, phase: 'done' };
}
