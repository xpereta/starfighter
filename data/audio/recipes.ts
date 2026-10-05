import type { SoundEntry, SynthLayer } from '../../src/render/style';

/**
 * Small helpers for writing sound recipes as data (used by the style packs' `sounds.ts`). They only
 * build plain `SynthLayer` / `SoundEntry` objects: edit the numbers, or write the objects by hand.
 */

/** An oscillator: waveform, start Hz, end Hz (the sweep; same as start for a steady tone), decay s, loudness 0..1. */
export function tone(
  waveform: 'sine' | 'square' | 'sawtooth' | 'triangle',
  freq: number,
  freqEnd: number,
  decay: number,
  gain: number,
  more: Partial<SynthLayer> = {},
): SynthLayer {
  return { waveform, freq, freqEnd, attack: 0.005, decay, gain, ...more };
}

/** A noise burst coloured by a filter that sweeps from `from` to `to` Hz. */
export function noise(
  filter: 'lowpass' | 'highpass' | 'bandpass',
  from: number,
  to: number,
  decay: number,
  gain: number,
  more: Partial<SynthLayer> = {},
): SynthLayer {
  return {
    waveform: 'noise',
    freq: 1000,
    attack: 0.003,
    decay,
    gain,
    filter: { type: filter, freq: from, freqEnd: to, q: 1 },
    ...more,
  };
}

/** A sound entry with sensible defaults; `over` changes any field. */
export function sfx(layers: readonly SynthLayer[], over: Partial<SoundEntry> = {}): SoundEntry {
  return {
    source: { kind: 'synth', layers },
    pitch: 1,
    pitchRandom: 0.06,
    volume: 0.4,
    minGap: 0.05,
    maxVoices: 4,
    ...over,
  };
}

/** Pan and fade for sounds that happen somewhere in the arena. */
export const AROUND = { pan: 0.7, range: 1000, farVolume: 0.3 } as const;
