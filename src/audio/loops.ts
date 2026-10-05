import type {
  LoopCurve,
  LoopEntry,
  LoopKey,
  LoopLayer,
  LoopStateKey,
  LoopTable,
} from '../render/style';
import { LOOP_KEYS } from '../render/style';

/** The game values loops follow, each already normalised (see `LOOP_STATES` in the style contract). */
export type LoopState = Record<LoopStateKey, number>;

export function zeroLoopState(): LoopState {
  return { speed: 0, throttle: 0, hull: 1, rescue: 0, missiles: 0, edge: 0, always: 0 };
}

/** Value of a piecewise-linear curve at the loop state; flat beyond the first and last point. */
export function sampleLoopCurve(curve: LoopCurve, state: LoopState): number {
  const x = state[curve.state];
  const pts = curve.points;
  const first = pts[0]!;
  if (x <= first[0]) return first[1];
  for (let i = 1; i < pts.length; i++) {
    const b = pts[i]!;
    if (x <= b[0]) {
      const a = pts[i - 1]!;
      const t = (x - a[0]) / (b[0] - a[0] || 1);
      return a[1] + (b[1] - a[1]) * t;
    }
  }
  return pts[pts.length - 1]![1];
}

/** Below this smoothed level a loop counts as off (and the backend stops its oscillators). */
export const LOOP_OFF_LEVEL = 0.002;

/** One loop for one audio frame: everything decided, the backend only sets node values. */
export interface LoopFrame {
  key: LoopKey;
  layers: readonly LoopLayer[];
  /** Changes when the layers change, so the backend rebuilds its nodes. */
  signature: string;
  /** Final loudness 0..1 (the smoothed curve value times the loop's volume). */
  gain: number;
  /** Multiplier on every oscillator's frequency. */
  pitch: number;
  /** Multiplier on every layer filter's cutoff. */
  cutoff: number;
  /** Reverb send 0..1. */
  send: number;
  /** The curve value before smoothing (what the game state asks for), for the panel readout. */
  target: number;
}

/**
 * The state the panel's loop preview uses: everything quiet, except the value the loop follows,
 * which is set to `value` (0..1; for `throttle` it spans -1..1 and the on/off values are 0 or 1).
 */
export function previewLoopState(entry: LoopEntry, value: number): LoopState {
  const s = zeroLoopState();
  s.always = 1;
  const v = clamp(value, 0, 1);
  const key = entry.gain.state;
  s[key] = key === 'throttle' ? v : key === 'edge' || key === 'always' ? (v >= 0.5 ? 1 : 0) : v;
  if (entry.pitch && entry.pitch.state !== key) s[entry.pitch.state] = v;
  if (entry.cutoff && entry.cutoff.state !== key) s[entry.cutoff.state] = v;
  return s;
}

export interface LoopPlanner {
  /**
   * Advances the fades by `dt` seconds and returns one frame per loop that is on or still fading
   * out. A loop that is fully off has no frame: the backend switches off what it does not get.
   */
  step(state: LoopState, dt: number): readonly LoopFrame[];
  /** Every loop silent again (a style switch, a restart). */
  reset(): void;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** The fade is a one-pole smoother; `fade` seconds gets it ~95% of the way (time constant = fade / 3). */
const FADE_TAU_DIVISOR = 3;

/**
 * The pure decision of what the continuous loops do: reads each loop's curves at the game state,
 * smooths the loudness with the loop's own fade times (no clicks, no jumps), and says when a loop
 * is off. No Web Audio here, so it is tested with plain numbers.
 */
export function createLoopPlanner(table: () => LoopTable): LoopPlanner {
  const levels = new Map<LoopKey, number>();
  return {
    step(state, dt) {
      const out: LoopFrame[] = [];
      const t = table();
      for (const key of LOOP_KEYS) {
        const entry: LoopEntry | 'silent' | undefined = t[key];
        if (entry === undefined || entry === 'silent') {
          levels.delete(key);
          continue;
        }
        const target = clamp(sampleLoopCurve(entry.gain, state), 0, 1);
        const level = levels.get(key) ?? 0;
        const fade = target > level ? entry.fadeIn : entry.fadeOut;
        const tau = Math.max(1e-3, fade / FADE_TAU_DIVISOR);
        let next = level + (target - level) * (1 - Math.exp(-Math.max(0, dt) / tau));
        if (target === 0 && next < LOOP_OFF_LEVEL) next = 0;
        levels.set(key, next);
        if (next === 0) continue; // fully off: no frame, the backend stops it
        out.push({
          key,
          layers: entry.layers,
          signature: JSON.stringify(entry.layers),
          gain: clamp(next * entry.volume, 0, 1),
          pitch: entry.pitch ? clamp(sampleLoopCurve(entry.pitch, state), 0.1, 8) : 1,
          cutoff: entry.cutoff ? clamp(sampleLoopCurve(entry.cutoff, state), 0.1, 8) : 1,
          send: clamp(entry.reverb ?? 0, 0, 1),
          target,
        });
      }
      return out;
    },
    reset() {
      levels.clear();
    },
  };
}
