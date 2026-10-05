import type { MusicDef, SoundEntry, SoundEventKey } from '../render/style';
import type { LoopFrame } from './loops';

/** One sound ready to play: everything is decided (pitch, volume, pan, space); the backend only makes noise. */
export interface PlayRequest {
  key: SoundEventKey;
  source: SoundEntry['source'];
  /** Final pitch multiplier, already randomised and clamped. */
  pitch: number;
  /** Final volume 0..1 before the effects/master mix. */
  volume: number;
  /** -1 (left) .. 1 (right). */
  pan: number;
  /** Seconds (s), including layer delays and holds but not the reverb tail. */
  duration: number;
  /** Reverb send 0..1 (how much goes to the shared space reverb). */
  send: number;
  /** Seconds between the dry sound and its reverb (s). */
  preDelay: number;
  /** Seconds the whole sound starts late (distance lag, s). */
  startDelay: number;
  /** Low-pass cutoff in Hz for distance muffling, or 0 for none. */
  cutoff: number;
}

export interface MixLevels {
  master: number;
  effects: number;
  music: number;
  /** Level of the reverb return, 0..1. */
  reverb: number;
  /** Length of the reverb tail, seconds (s). */
  reverbTime: number;
}

/** Which bus a duck dips: the music, or the continuous loops. */
export type DuckBus = 'music' | 'loops';

/** What the engine needs from the sound hardware. The Web Audio one is `webaudio.ts`; tests use `fake-backend.ts`. */
export interface AudioBackend {
  /** Seconds on the audio clock (s). */
  readonly now: number;
  /** Creates/resumes the audio context. Must run inside a user gesture (browser rule). */
  start(): void;
  play(req: PlayRequest): void;
  setMix(mix: MixLevels): void;
  /** Suspends (true) or resumes (false) all sound; sounds already playing are cut after a short tail. */
  setSuspended(suspended: boolean): void;
  /** Starts looping this music track (replacing the current one), or stops the music with null. */
  setMusic(music: MusicDef | null): void;
  /** Dips the music (or the loops) by `amount` (0..1) for `time` seconds. */
  duck(amount: number, time: number, bus?: DuckBus): void;
  /** Sets the continuous loops for this frame; a loop that is not in the list is switched off. */
  setLoops(frames: readonly LoopFrame[]): void;
}
