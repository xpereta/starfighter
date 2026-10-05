import { defaultsOf, type ParamDef } from '../../src/core/params/params';

/**
 * Missile fighter ("lancer") and enemy missile tuning (spec section 4), a STUB for track B: typed
 * and validated, not yet read by gameplay and not yet part of `Tuning`, the panel or the replay.
 * Only `missileCap` is used already, to size the (empty) enemy missile pool. Units: u, s; degrees here.
 */
export const lancerParams = {
  missileCap: {
    default: 16,
    min: 2,
    max: 128,
    unit: 'missiles',
    note: 'How many enemy missiles can be in flight at once (the pool size, read when the world is created). Higher = room for bigger barrages; lower = saves memory.',
  },
  missileInterval: {
    default: 6,
    min: 1,
    max: 30,
    unit: 's',
    note: 'Seconds between missile launches of one lancer. Higher = rare, readable threats; lower = a constant barrage.',
  },
  missileLife: {
    default: 5,
    min: 1,
    max: 15,
    unit: 's',
    note: 'How long an enemy missile flies before it burns out. Higher = it chases you for longer; lower = easy to outlast.',
  },
  missileDamage: {
    default: 2,
    min: 1,
    max: 5,
    unit: 'hp',
    note: 'Hull points an enemy missile takes from the player (a bullet takes 1). Higher = each missile is a real danger; lower = a nuisance.',
  },
  missileTurnRate: {
    default: 90,
    min: 20,
    max: 360,
    unit: '°/s',
    note: 'How fast an enemy missile can turn. Higher = hard to shake with a turn; lower = a hard turn makes it miss.',
  },
  missileMaxSpeed: {
    default: 650,
    min: 200,
    max: 1500,
    unit: 'u/s',
    note: 'Top speed of an enemy missile. Higher = less time to react; lower = more time to roll.',
  },
  missileAccel: {
    default: 400,
    min: 50,
    max: 2000,
    unit: 'u/s²',
    note: 'How quickly an enemy missile speeds up after launch. Higher = it arrives sooner; lower = a slow, visible launch.',
  },
  rangeMin: {
    default: 900,
    min: 200,
    max: 3000,
    unit: 'u',
    note: 'Closest distance a lancer likes to keep to its target. Higher = it hangs back; lower = it closes in.',
  },
  rangeMax: {
    default: 1500,
    min: 400,
    max: 4000,
    unit: 'u',
    note: 'Farthest distance at which a lancer fires. Higher = missiles from afar; lower = it must come close.',
  },
  speedScale: {
    default: 0.9,
    min: 0.5,
    max: 1.4,
    unit: 'x',
    note: 'Lancer speed compared with yours (a normal fighter is 0.79). Higher = it keeps up with you; lower = easy to run down.',
  },
} as const satisfies Record<string, ParamDef>;

export type LancerConfig = { -readonly [K in keyof typeof lancerParams]: number };

export function createLancerConfig(): LancerConfig {
  return defaultsOf(lancerParams);
}
