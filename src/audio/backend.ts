import type { MusicDef, SoundEntry, SoundEventKey } from '../render/style';

/** One sound ready to play: everything is decided (pitch, volume, pan); the backend only makes noise. */
export interface PlayRequest {
  key: SoundEventKey;
  source: SoundEntry['source'];
  /** Final pitch multiplier, already randomised and clamped. */
  pitch: number;
  /** Final volume 0..1 before the effects/master mix. */
  volume: number;
  /** -1 (left) .. 1 (right). */
  pan: number;
  /** Seconds (s). */
  duration: number;
}

export interface MixLevels {
  master: number;
  effects: number;
  music: number;
}

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
  /** Dips the music by `amount` (0..1) for `time` seconds. */
  duck(amount: number, time: number): void;
}
