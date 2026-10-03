import { defaultsOf, type ParamDef } from '../../src/core/params/params';

/** Missile and salvo tuning (spec section 2). Units: world units (u), seconds (s); angles in degrees here, radians inside core. */
export const missilesParams = {
  missileCap: {
    default: 64,
    min: 8,
    max: 512,
    unit: 'missiles',
    note: 'How many missiles can be in flight at once (the pool size). It is read when the world is created, so changing it live has no effect until a reload. Higher = room for bigger salvos; lower = saves memory.',
  },
  salvoCooldown: {
    default: 4,
    min: 0.5,
    max: 15,
    step: 0.1,
    unit: 's',
    note: 'How long before the next salvo can be launched, counted from the launch. Higher = salvos feel like a big, rare strike; lower = you can keep firing as fast as you can lock.',
  },
  salvoStagger: {
    default: 0.1,
    min: 0,
    max: 0.5,
    step: 0.01,
    unit: 's',
    note: 'The delay between one missile of a salvo and the next, so the salvo ripples out instead of leaving all at once. Higher = a long, dramatic ripple; 0 = every missile leaves together.',
  },
  launchSpeed: {
    default: 200,
    min: 50,
    max: 800,
    unit: 'u/s',
    note: 'How fast a missile leaves the launcher, on top of the launcher’s own forward speed. Higher = it jumps out and reaches targets sooner; lower = a slow, visible launch before it accelerates.',
  },
  missileAccel: {
    default: 600,
    min: 100,
    max: 2000,
    unit: 'u/s²',
    note: 'How quickly a missile speeds up after launch. Higher = it reaches full speed almost at once; lower = a lazy start that gives targets time to turn away.',
  },
  missileMaxSpeed: {
    default: 750,
    min: 300,
    max: 1500,
    unit: 'u/s',
    note: 'Top speed of a missile. Higher = hard to escape and more punishing; lower = fast fighters can outrun them. It should stay well above the fastest ship.',
  },
  missileTurnRate: {
    default: 160,
    min: 30,
    max: 720,
    unit: '°/s',
    note: 'How sharply a missile can turn toward its target. Higher = near-certain hits even on tight turns; lower = targets that cut across its path can make it miss, and it needs room to curve.',
  },
  wobbleAmount: {
    default: 3,
    min: 0,
    max: 15,
    step: 0.1,
    unit: '°',
    note: 'How far a missile’s flight path weaves from side to side, for a hand-made look instead of a perfect line. Higher = a visible zig-zag that can cost accuracy; 0 = laser straight.',
  },
  wobbleHz: {
    default: 5,
    min: 0.5,
    max: 20,
    step: 0.5,
    unit: 'Hz',
    note: 'How fast the weaving repeats. Higher = a quick shiver; lower = a slow, lazy snake. It has no effect when the wobble amount is 0.',
  },
  missileLife: {
    default: 4.5,
    min: 1,
    max: 12,
    step: 0.1,
    unit: 's',
    note: 'How long a missile flies before it burns out harmlessly. Higher = missiles chase targets for a long time, across the map; lower = they must be fired at fairly close targets.',
  },
  missileRadius: {
    default: 14,
    min: 4,
    max: 60,
    unit: 'u',
    note: 'The size of a missile’s hit circle; it hits any enemy it touches, not just its target. Higher = forgiving, hits things on the way; lower = it must fly straight at the target’s middle.',
  },
  missileDamage: {
    default: 4,
    min: 1,
    max: 20,
    unit: 'hp',
    note: 'How much damage one missile does. A drone has about 4 hp and an enemy fighter 3, so the default kills either in one hit. Higher = a salvo wipes out whole groups; lower = a target needs several missiles.',
  },
  missileHitImpulse: {
    default: 3,
    min: 0,
    max: 20,
    unit: 'impulse',
    note: 'How hard a missile hit shoves and shakes things, for hit effects and camera shake. Guns use 1. Higher = missile hits feel heavy; 0 = they hit without any kick.',
  },
} as const satisfies Record<string, ParamDef>;

export type MissilesConfig = { -readonly [K in keyof typeof missilesParams]: number };

export function createMissilesConfig(): MissilesConfig {
  return defaultsOf(missilesParams);
}
