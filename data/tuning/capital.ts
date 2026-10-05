import { defaultsOf, type ParamDef } from '../../src/core/params/params';

/**
 * Capital ship tuning (spec section 5), a STUB for track C: typed and validated, not yet read by
 * gameplay and not yet part of `Tuning`, the panel or the replay. The parts themselves are data
 * in `data/content/capital.ts`. Units: u, s; degrees here, radians inside core.
 */
export const capitalParams = {
  hullRadius: {
    default: 700,
    min: 300,
    max: 1500,
    unit: 'u',
    note: 'Radius of the whole capital ship; every part must fit inside it. Higher = a bigger ship with more room for parts; lower = a compact boss.',
  },
  cruiseSpeed: {
    default: 40,
    min: 0,
    max: 300,
    unit: 'u/s',
    note: 'How fast the capital ship drifts towards the player while its engines work. 0 = it never moves; higher = it closes in quickly.',
  },
  turnRate: {
    default: 8,
    min: 0,
    max: 60,
    unit: '°/s',
    note: 'How fast the capital ship turns to keep its broadside on the player. Higher = harder to get behind it; lower = easy to flank.',
  },
  lockPartCap: {
    default: 3,
    min: 1,
    max: 8,
    unit: 'parts',
    note: 'Most parts of one capital ship a missile salvo may lock, so a salvo is not wasted on tiny parts. Higher = more spread; lower = focused fire.',
  },
  blindAccuracyScale: {
    default: 0.5,
    min: 0,
    max: 1,
    step: 0.05,
    unit: 'x',
    note: 'How accurate its turrets stay once the bridge is destroyed (1 = unchanged). Lower = a destroyed bridge makes the guns much worse.',
  },
  escortWings: {
    default: 2,
    min: 0,
    max: 6,
    unit: 'wings',
    note: 'Formation wings escorting the capital ship. Higher = the player cannot hover at the capital; lower = a duel.',
  },
} as const satisfies Record<string, ParamDef>;

export type CapitalConfig = { -readonly [K in keyof typeof capitalParams]: number };

export function createCapitalConfig(): CapitalConfig {
  return defaultsOf(capitalParams);
}
