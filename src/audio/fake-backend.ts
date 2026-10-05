import type { MusicDef } from '../render/style';
import type { AudioBackend, DuckBus, MixLevels, PlayRequest } from './backend';
import type { LoopFrame } from './loops';

/** Records everything the engine asks for. For tests. */
export interface FakeBackend extends AudioBackend {
  now: number;
  started: boolean;
  suspended: boolean;
  mix: MixLevels;
  music: MusicDef | null;
  readonly played: PlayRequest[];
  readonly ducks: { amount: number; time: number; bus: DuckBus }[];
  /** The latest loop frames the engine sent. */
  loops: readonly LoopFrame[];
  /** How many times `setLoops` was called. */
  loopCalls: number;
}

export function createFakeBackend(): FakeBackend {
  return {
    now: 0,
    started: false,
    suspended: false,
    mix: { master: 1, effects: 1, music: 1, reverb: 1, reverbTime: 2 },
    music: null,
    played: [],
    ducks: [],
    loops: [],
    loopCalls: 0,
    start() {
      this.started = true;
    },
    play(req) {
      this.played.push(req);
    },
    setMix(mix) {
      this.mix = { ...mix };
    },
    setSuspended(s) {
      this.suspended = s;
    },
    setMusic(music) {
      this.music = music;
    },
    duck(amount, time, bus = 'music') {
      this.ducks.push({ amount, time, bus });
    },
    setLoops(frames) {
      this.loops = frames;
      this.loopCalls++;
    },
  };
}
