import { defaultsOf, type ParamDef } from '../../src/core/params/params';

/** Radio chatter (spec: docs/specs/prototype-3-pilots.md section 4). Presentation only. Units: seconds (s). */
export const chatterParams = {
  chatterGap: {
    default: 2.5,
    min: 0,
    max: 10,
    unit: 's',
    note: 'Minimum time between two radio lines. Higher = a quieter radio, only the most important lines get through; lower = a busier radio where nearly every event is spoken.',
  },
  chatterLines: {
    default: 3,
    min: 1,
    max: 6,
    unit: 'lines',
    note: 'How many radio lines can be on screen at once. Higher = more of the recent chatter stays visible; lower = only the latest lines.',
  },
  chatterLife: {
    default: 6,
    min: 1,
    max: 20,
    unit: 's',
    note: 'How long a radio line stays on screen before it has faded away (it fades during its last second). Higher = lines linger; lower = they vanish quickly.',
  },
  killChance: {
    default: 0.4,
    min: 0,
    max: 1,
    unit: '',
    note: 'Chance that a pilot kill gets a radio line. Kills are the most common event, so this keeps the radio from turning into noise. 1 = every kill is called out; 0 = kills are silent.',
  },
  lowHull: {
    default: 1,
    min: 1,
    max: 5,
    unit: 'hp',
    note: 'A pilot calls for help when a hit leaves them at this many hit points or fewer. Higher = they complain earlier; lower = only when they are about to go down.',
  },
} as const satisfies Record<string, ParamDef>;

export type ChatterConfig = { -readonly [K in keyof typeof chatterParams]: number };

export function createChatterConfig(): ChatterConfig {
  return defaultsOf(chatterParams);
}
