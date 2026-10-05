import type { MusicDef } from '../render/style';
import type { AudioBackend, MixLevels, PlayRequest } from './backend';

/** Records everything the engine asks for. For tests. */
export interface FakeBackend extends AudioBackend {
  now: number;
  started: boolean;
  suspended: boolean;
  mix: MixLevels;
  music: MusicDef | null;
  readonly played: PlayRequest[];
  readonly ducks: { amount: number; time: number }[];
}

export function createFakeBackend(): FakeBackend {
  return {
    now: 0,
    started: false,
    suspended: false,
    mix: { master: 1, effects: 1, music: 1 },
    music: null,
    played: [],
    ducks: [],
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
    duck(amount, time) {
      this.ducks.push({ amount, time });
    },
  };
}
