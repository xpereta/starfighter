import { defaultsOf, type ParamDef } from '../../src/core/params/params';

/**
 * Missile fighter ("lancer") and enemy missile tuning (spec section 4; track B). Part of `Tuning`
 * (panel section "Missile fighter", replay version 8). Units: u, s; angles in degrees here, radians
 * inside core. The fairness budget (launch to impact versus the roll's 0.3 s of i-frames) is in
 * `src/core/enemies/README.md`.
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
  launchSpeed: {
    default: 150,
    min: 0,
    max: 600,
    unit: 'u/s',
    note: "How fast an enemy missile leaves the launcher (the launcher's own speed is not added). Higher = it jumps out and arrives sooner; lower = a slow, visible launch that gives you time to see it.",
  },
  missileRadius: {
    default: 14,
    min: 3,
    max: 60,
    unit: 'u',
    note: 'Size of the enemy missile hit circle (added to your ship radius). Higher = it connects from farther away; lower = near misses count as misses.',
  },
  hitImpulse: {
    default: 2.5,
    min: 0,
    max: 6,
    unit: 'x',
    note: 'Screen shake and spark strength when an enemy missile hits you (a bullet is 1). Higher = a heavy, scary hit; lower = barely felt.',
  },
  practiceKnock: {
    default: 150,
    min: 0,
    max: 500,
    unit: 'u/s',
    note: 'Practice mode has no hull, so a missile hit costs you this much speed instead (never below your slowest speed), and shakes the screen. Runs ignore it: a hit takes Missile damage from the hull. Higher = a stronger shove; 0 = only the shake.',
  },
  turnRateScale: {
    default: 0.66,
    min: 0.3,
    max: 1.5,
    unit: 'x',
    note: 'Lancer turn rate compared with yours (a normal fighter is 0.66). Higher = it lines up its shot sooner and is harder to get behind; lower = sluggish.',
  },
  launchCone: {
    default: 25,
    min: 3,
    max: 90,
    unit: '°',
    note: 'How well a lancer must be pointing at you before it fires (half-angle). It turns to face you first, which is your cue. Higher = it fires from wider angles, so missiles start off-line and need to turn; lower = a long, readable line-up.',
  },
  burstSize: {
    default: 2,
    min: 1,
    max: 4,
    unit: 'missiles',
    note: 'Missiles per launch once the battle reaches Burst from battle (spec: pairs on the higher battles). Higher = harder to roll through, since your roll only covers 0.3 s; 1 = always single shots.',
  },
  burstFromBattle: {
    default: 4,
    min: 1,
    max: 99,
    unit: 'battle',
    note: 'First run battle in which lancers fire bursts of Burst size missiles. Earlier battles (and practice mode) get single shots. Higher = bursts come later in the run; 1 = bursts everywhere in runs.',
  },
  burstGap: {
    default: 0.4,
    min: 0.1,
    max: 2,
    unit: 's',
    note: 'Seconds between the missiles of one burst. Below your roll window (0.3 s) one roll beats both; above it you need a turn or a second roll. Higher = easier to handle one at a time; lower = they arrive together.',
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

export type LancerConfig = { -readonly [K in keyof typeof lancerParams]: number } & {
  /**
   * Local hook until the authored battle table spawns lancers: in run battles, replace the fighters
   * of some waves with lancers (`LANCER_RAMP` in data/content/kinds/lancer.ts). Off = today's waves.
   */
  inBattles: boolean;
};

export function createLancerConfig(): LancerConfig {
  return { ...defaultsOf(lancerParams), inBattles: false };
}
