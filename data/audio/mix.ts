import { defaultsOf, type ParamDef } from '../../src/core/params/params';

/** The mix (spec: docs/specs/prototype-4-look-and-sound.md section 5). Presentation only: never part of the world or the hash. */
export const mixParams = {
  master: {
    default: 0.7,
    min: 0,
    max: 1,
    unit: '',
    note: 'Overall volume of everything you hear (effects and music). Higher = louder; 0 = silence. The M key mutes and unmutes without changing it.',
  },
  effects: {
    default: 1,
    min: 0,
    max: 1,
    unit: '',
    note: 'Volume of the sound effects (shots, hits, explosions, radio blips) relative to the master. Lower it to hear the music better or to make a busy fight less tiring.',
  },
  music: {
    default: 0.6,
    min: 0,
    max: 1,
    unit: '',
    note: 'Volume of the music track relative to the master, before ducking. 0 = no music even if the style has one.',
  },
  reverb: {
    default: 0.8,
    min: 0,
    max: 1.5,
    unit: '',
    note: "Level of the shared space reverb (the tail after explosions, guns and radio). Each sound sends its own share of it (the sound's Reverb send). 0 = a dry cockpit; higher = a bigger, emptier space.",
  },
  reverbTime: {
    default: 2.6,
    min: 0.5,
    max: 6,
    unit: 's',
    note: 'How long the space reverb rings. Short = a small bay; long = open space. Changing it rebuilds the reverb, so it clicks once.',
  },
} as const satisfies Record<string, ParamDef>;

export type MixConfig = { -readonly [K in keyof typeof mixParams]: number };

export function createMixConfig(): MixConfig {
  return defaultsOf(mixParams);
}
