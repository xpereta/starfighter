import type { PostDef } from '../spectacle-contract';

/** Biggest zoom the punch adds to the finished picture (share of its size) at punch 1. */
export const MAX_ZOOM = 0.08;
/** The punch settles with this time constant (s): a quick push in, a soft return. */
export const PUNCH_TIME = 0.16;

export interface PostFrame {
  /** Colour fringe strength 0..1. */
  chroma: number;
  vignette: number;
  grain: number;
  scanlines: number;
  /** Zoom of the finished picture, 0..MAX_ZOOM. */
  zoom: number;
  /** True when nothing but the plain picture would come out (the composer can be skipped). */
  neutral: boolean;
}

export interface PostState {
  /** A hit or a big kill: starts the colour-fringe pulse (0..1, the strongest wins). */
  hit(amount: number): void;
  /** A big kill: starts the zoom punch (0..1, the strongest wins). */
  punch(amount: number): void;
  /** Advances by `dt` wall-clock seconds and returns what to draw with. */
  step(dt: number, def: PostDef, enabled: boolean, intensity: number): PostFrame;
}

/** The transient part of the post-processing (pulse and punch), pure so it can be tested. */
export function createPostState(): PostState {
  let pulse = 0;
  let punch = 0;
  const frame: PostFrame = {
    chroma: 0,
    vignette: 0,
    grain: 0,
    scanlines: 0,
    zoom: 0,
    neutral: true,
  };
  return {
    hit(amount) {
      pulse = Math.max(pulse, Math.min(1, amount));
    },
    punch(amount) {
      punch = Math.max(punch, Math.min(1, amount));
    },
    step(dt, def, enabled, intensity) {
      const decay = Math.max(def.chromatic.decay, 1e-3);
      pulse = Math.max(0, pulse - dt / decay);
      punch *= Math.exp(-dt / PUNCH_TIME);
      if (punch < 1e-3) punch = 0;
      if (!enabled) {
        frame.chroma = frame.vignette = frame.grain = frame.scanlines = frame.zoom = 0;
        frame.neutral = true;
        return frame;
      }
      frame.chroma = Math.min(1, def.chromatic.base + def.chromatic.hit * pulse * intensity);
      frame.vignette = def.vignette;
      frame.grain = def.grain;
      frame.scanlines = def.scanlines;
      frame.zoom = punch * def.punch * intensity * MAX_ZOOM;
      frame.neutral =
        frame.chroma === 0 &&
        frame.vignette === 0 &&
        frame.grain === 0 &&
        frame.scanlines === 0 &&
        frame.zoom === 0;
      return frame;
    },
  };
}
