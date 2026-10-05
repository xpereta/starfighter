import { defaultsOf, type ParamDef } from '../../src/core/params/params';

/** Run tuning (spec: docs/specs/prototype-3-pilots.md section 1): how many battles, how big, how hard, and the player's hull. */
export const runParams = {
  battleCount: {
    default: 4,
    min: 1,
    max: 8,
    unit: 'battles',
    note: 'How many battles a run lasts. The last one is the hardest; clearing it wins the run. Higher = a longer run where losses add up; lower = a quick run.',
  },
  wavesBase: {
    default: 2,
    min: 1,
    max: 8,
    unit: 'waves',
    note: 'Classic ramp only (the authored battle table sets its own). Enemy waves in the first battle. A battle is won when its last wave is cleared. Higher = longer, harder battles from the start.',
  },
  wavesPerBattle: {
    default: 0.7,
    min: 0,
    max: 3,
    unit: 'waves',
    note: 'Classic ramp only (the authored battle table sets its own). Extra waves each battle adds on top of the first one (the total is rounded). 0.7 gives 2, 3, 3, 4 waves over four battles. Higher = battles grow longer faster.',
  },
  waveSizeBase: {
    default: 3,
    min: 1,
    max: 12,
    unit: 'fighters',
    note: 'Classic ramp only (the authored battle table sets its own). Enemy fighters in each wave of the first battle. Higher = a harder run from the start; lower = a gentler opening.',
  },
  waveGrowth: {
    default: 1,
    min: 0,
    max: 4,
    unit: 'fighters',
    note: 'Classic ramp only (the authored battle table sets its own). Fighters each wave gains per battle. With the first-battle size of 3 and a growth of 1, battle 4 sends waves of 6. Higher = a steeper climb; 0 = every battle has the same size waves.',
  },
  turretsFromBattle: {
    default: 3,
    min: 1,
    max: 9,
    unit: 'battle',
    note: 'Classic ramp only (the authored battle table sets its own). The first battle that has gun turrets in the arena. Earlier battles have none. Higher = turrets arrive later.',
  },
  turretsBase: {
    default: 2,
    min: 0,
    max: 8,
    unit: 'turrets',
    note: 'Classic ramp only (the authored battle table sets its own). Turrets in the first battle that has them. 0 = no turrets in any battle.',
  },
  turretsGrowth: {
    default: 1,
    min: 0,
    max: 4,
    unit: 'turrets',
    note: 'Classic ramp only (the authored battle table sets its own). Extra turrets for each battle after the first one that has turrets. Higher = more fire to dodge in the last battles.',
  },
  playerHull: {
    default: 5,
    min: 1,
    max: 20,
    unit: 'hp',
    note: 'Your own hull. Each enemy bullet that hits you takes 1 (a roll in progress still protects you). At 0 the run ends in defeat. Restored in full at every debrief. Higher = more forgiving; lower = every hit counts.',
  },
  startingSquad: {
    default: 2,
    min: 0,
    max: 4,
    unit: 'pilots',
    note: 'Pilots you begin a run with. Veterans you bring come first, and generated pilots fill the rest up to this number. 0 = you start alone and build the squad from rescues and picks.',
  },
} as const satisfies Record<string, ParamDef>;

export type RampMode = 'authored' | 'classic';

export type RunConfig = { -readonly [K in keyof typeof runParams]: number } & {
  /** `authored`: battles come from the battle table (`data/content/battles.ts`); `classic`: the old fighter-only ramp from the wave and size numbers here. */
  ramp: RampMode;
};

export function createRunConfig(): RunConfig {
  return { ...defaultsOf(runParams), ramp: 'authored' };
}
