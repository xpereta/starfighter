import { defaultsOf, type ParamDef } from '../../src/core/params/params';

/**
 * Gunship tuning (spec section 3), read live by `core/ai/gunship.ts`: a slow tough ship with two
 * independent rapid-fire turrets. Units: world units (u), seconds (s); angles in degrees here,
 * radians inside core. Spec numbers are starting defaults to tune after play.
 */
export const gunshipParams = {
  hull: {
    default: 12,
    min: 1,
    max: 100,
    unit: 'hp',
    note: 'Hull points of a gunship (a fighter has 3). Higher = a long fight that needs a missile salvo or the squad; lower = it drops like a fighter. Read when it spawns.',
  },
  radius: {
    default: 70,
    min: 20,
    max: 300,
    unit: 'u',
    note: 'Hit circle of a gunship (a fighter is 28). Higher = a big easy target that is hard to slip past; lower = a smaller one. Read when it spawns.',
  },
  speedScale: {
    default: 0.35,
    min: 0.1,
    max: 1.5,
    step: 0.05,
    unit: 'x player',
    note: 'Gunship speed compared with yours. Higher = it can chase you and reposition fast; lower = a slow hulk you can fly circles around. It never goes below the flight model minimum speed.',
  },
  turnRateScale: {
    default: 0.3,
    min: 0.05,
    max: 1.5,
    step: 0.05,
    unit: 'x player',
    note: 'How fast the gunship hull turns compared with you. Higher = it brings its turrets to bear quickly; lower = easy to flank, because it cannot follow you round.',
  },
  standoff: {
    default: 700,
    min: 200,
    max: 2500,
    unit: 'u',
    note: 'Distance the gunship tries to keep from the player. Higher = it shells you from afar; lower = it comes close and is easier to flank.',
  },
  standoffBand: {
    default: 250,
    min: 50,
    max: 1000,
    unit: 'u',
    note: 'How far from the standoff distance it may drift before it closes in (further out) or backs off (closer in). Inside the band it circles the player broadside. Higher = lazy, loose station keeping; lower = it holds the distance tightly.',
  },
  turretFireRate: {
    default: 10,
    min: 1,
    max: 30,
    unit: 'shots/s',
    note: 'How fast each gunship turret fires while in a burst. Higher = a denser stream to dodge; lower = sparser fire.',
  },
  turretBurstShots: {
    default: 6,
    min: 1,
    max: 60,
    unit: 'shots',
    note: 'Shots in one turret burst before it pauses. Higher = longer bursts and fewer windows to attack; lower = more windows.',
  },
  turretBurstPause: {
    default: 2.2,
    min: 0,
    max: 8,
    step: 0.1,
    unit: 's',
    note: 'Pause between turret bursts: the window in which flying close is safe. Higher = more openings; lower = near-constant fire.',
  },
  turretArc: {
    default: 100,
    min: 30,
    max: 180,
    unit: '°',
    note: 'Half-width of each turret firing arc. At 100 the two arcs leave only a thin wedge straight behind the ship uncovered (the blind spot to flank through). Higher = smaller blind spot, 140+ none; lower = bigger blind spots, also at the front.',
  },
  turretArcCenter: {
    default: 60,
    min: 0,
    max: 120,
    unit: '°',
    note: 'Where each turret arc is centred, measured from the nose towards its own side (left turret to the left). 90 = straight out to the side, 0 = both look dead ahead. Higher = the front is covered less and the rear more.',
  },
  turretTurnRate: {
    default: 90,
    min: 10,
    max: 360,
    unit: '°/s',
    note: 'How fast a turret swings to follow its target inside its arc. Higher = it tracks a fast ship well; lower = a fast flyer slips past its aim.',
  },
  turretFireCone: {
    default: 6,
    min: 1,
    max: 45,
    unit: '°',
    note: 'A turret only fires when it points this close to where it wants to aim. Higher = it sprays while still swinging round; lower = it waits until it is on target.',
  },
  turretLead: {
    default: 0.7,
    min: 0,
    max: 1,
    step: 0.05,
    unit: 'fraction',
    note: 'How much of the perfect lead the turrets aim with (1 = exactly where a straight-flying target will be, 0 = straight at it). Lower = they miss a target that keeps changing course; higher = a straight flyer is hit.',
  },
  turretSpread: {
    default: 6,
    min: 0,
    max: 20,
    unit: '°',
    note: 'Random aim error of each shot, maximum angle. Higher = a wider cone of bullets that is hard to slip through but misses more; lower = a tight stream.',
  },
  turretBulletSpeed: {
    default: 700,
    min: 100,
    max: 2000,
    unit: 'u/s',
    note: 'Turret bullet speed on top of the gunship own. Higher = harder to dodge; lower = easy to see coming and avoid.',
  },
  turretBulletLife: {
    default: 1.2,
    min: 0.2,
    max: 5,
    step: 0.1,
    unit: 's',
    note: 'How long a turret bullet flies. Together with its speed this is the effective range of a stream; also how many bullets are in the air (the shot pool is shared with turrets).',
  },
  turretRange: {
    default: 800,
    min: 200,
    max: 3000,
    unit: 'u',
    note: 'Distance beyond which a turret does not open fire. Higher = it hits you from further away; lower = you only need to stay out of this circle.',
  },
} as const satisfies Record<string, ParamDef>;

export type GunshipConfig = { -readonly [K in keyof typeof gunshipParams]: number };

export function createGunshipConfig(): GunshipConfig {
  return defaultsOf(gunshipParams);
}
