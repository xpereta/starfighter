import { defaultsOf, type ParamDef } from '../../src/core/params/params';

/** Pilot and squad tuning (spec: docs/specs/prototype-3-pilots.md section 2). Trait multipliers live in data/content/traits.ts. */
export const pilotsParams = {
  squadMax: {
    default: 4,
    min: 1,
    max: 4,
    unit: 'pilots',
    note: 'The most pilots your squad can hold at once. Rescues and the post-battle pick only offer a pilot while there is a free slot. Higher = a bigger squadron and bigger salvos; lower = a small, precious squad.',
  },
  pickCount: {
    default: 3,
    min: 2,
    max: 5,
    unit: 'pilots',
    note: 'How many generated pilots the post-battle pick offers (each with a different trait). Higher = more choice; lower = a harder, more random squad.',
  },
  guardPreference: {
    default: 0.5,
    min: 0,
    max: 0.9,
    unit: 'fraction',
    note: 'How much closer an enemy that is chasing you counts for a Guardian pilot when it picks a target. 0 = no preference; higher = Guardians drop everything to hit whatever is on your tail.',
  },
  veteransPerRun: {
    default: 2,
    min: 0,
    max: 4,
    unit: 'pilots',
    note: 'How many saved veterans you may bring into a new run from the Start screen. Higher = a stronger opening squad; 0 = every run starts with a fresh squad.',
  },
  veteranCap: {
    default: 8,
    min: 1,
    max: 16,
    unit: 'veterans',
    note: 'The most veterans the save keeps. When a run ends with more, the ones with the most kills are kept. Higher = a bigger bench to choose from; lower = veterans are rarer and more precious.',
  },
} as const satisfies Record<string, ParamDef>;

export type PilotsConfig = { -readonly [K in keyof typeof pilotsParams]: number };

export function createPilotsConfig(): PilotsConfig {
  return defaultsOf(pilotsParams);
}
