import type { MusicDef } from '../render/style';

export type LoopSource = Extract<MusicDef['source'], { kind: 'loop' }>;

/** Steps are eighth notes. */
export const STEPS_PER_BEAT = 2;
/** The bass plays this many octaves below the root. */
export const BASS_OCTAVES_DOWN = 2;
/** Loudness of the melody and the bass inside the track, 0..1. */
export const MELODY_GAIN = 0.35;
export const BASS_GAIN = 0.5;

export interface LoopNote {
  /** Seconds from the start of the loop pass (s). */
  at: number;
  /** Length of the note (s). */
  length: number;
  /** Hz. */
  freq: number;
  gain: number;
  bass: boolean;
}

/** Seconds per step (s). */
export function stepSeconds(loop: LoopSource): number {
  return 60 / loop.bpm / STEPS_PER_BEAT;
}

/** Seconds of one pass of the loop (s). */
export function loopLength(loop: LoopSource): number {
  return stepSeconds(loop) * loop.steps.length;
}

export function semitone(root: number, semitones: number): number {
  return root * 2 ** (semitones / 12);
}

/** Every note of one pass of a synthesised loop. A note lasts until the next step. Pure. */
export function loopNotes(loop: LoopSource): LoopNote[] {
  const step = stepSeconds(loop);
  const notes: LoopNote[] = [];
  const add = (line: readonly (number | null)[] | undefined, bass: boolean): void => {
    line?.forEach((n, i) => {
      if (n === null) return;
      const root = bass ? loop.root / 2 ** BASS_OCTAVES_DOWN : loop.root;
      notes.push({
        at: i * step,
        length: step * 0.95,
        freq: semitone(root, n),
        gain: bass ? BASS_GAIN : MELODY_GAIN,
        bass,
      });
    });
  };
  add(loop.steps, false);
  add(loop.bass, true);
  return notes.sort((a, b) => a.at - b.at);
}
