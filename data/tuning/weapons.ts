import { defaultsOf, type ParamDef } from '../../src/core/params/params';

/** Gun tuning. Units: world units (u), seconds (s), degrees here (radians inside core). */
export const weaponsParams = {
  fireRate: {
    default: 22,
    min: 3,
    max: 30,
    unit: 'shots/s',
    note: 'Shots per second while the fire button is held. Higher = stronger, faster guns; lower = slower, more deliberate shots.',
  },
  bulletSpeed: {
    default: 900,
    min: 300,
    max: 1800,
    unit: 'u/s',
    note: 'Bullet speed on top of the ship speed. Higher = flatter shots that are easier to aim; lower = slow bullets that need leading.',
  },
  bulletLife: {
    default: 1.89,
    min: 0.3,
    max: 2,
    unit: 's',
    note: 'How long a bullet flies before it vanishes. Higher = longer range; lower = short range that forces you to get close.',
  },
  spread: {
    default: 4.64,
    min: 0,
    max: 5,
    unit: '°',
    note: 'Random aim error per shot, in degrees. Higher = sprayier and less accurate; 0 = laser accurate.',
  },
  bulletRadius: {
    default: 1,
    min: 1,
    max: 30,
    unit: 'u',
    note: 'Size of a bullet hit circle. Higher = forgiving hits on small or fast targets; lower = precise aim needed.',
  },
  bulletDamage: {
    default: 1,
    min: 1,
    max: 10,
    unit: 'hp',
    note: 'Hit points removed per bullet. Higher = targets die in fewer hits; lower = longer fights.',
  },
  hitImpulse: {
    default: 1,
    min: 0,
    max: 10,
    unit: '',
    note: 'Strength handed to hit effects (nudges and FX) with every hit. Higher = stronger reactions; 0 = none.',
  },
  barrelOffset: {
    default: 14,
    min: 0,
    max: 60,
    unit: 'u',
    note: 'Sideways distance of the two alternating guns from the ship center. Higher = a wider stream of fire; 0 = a single centered stream.',
  },
  muzzleOffset: {
    default: 50,
    min: 0,
    max: 120,
    unit: 'u',
    note: 'How far ahead of the ship bullets appear. Higher = bullets start farther out; 0 = from the ship center.',
  },
  /** Pool size; read once when the world is created, so changing it live has no effect. */
  bulletCap: {
    default: 400,
    min: 10,
    max: 2000,
    unit: 'bullets',
    note: 'Size of the bullet pool, fixed when the game starts (reload to apply). Higher = never drops a shot but uses more memory; lower = shots are dropped when too many are in flight.',
  },
} as const satisfies Record<string, ParamDef>;

export type WeaponsConfig = { -readonly [K in keyof typeof weaponsParams]: number };

export function createWeaponsConfig(): WeaponsConfig {
  return defaultsOf(weaponsParams);
}
