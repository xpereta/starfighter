import { DEG } from '../../src/core/math';
import type { CapitalPartDef } from '../../src/core/enemies/capital-parts';
import type { WeaponMount } from '../../src/core/enemies/mounts';
import { validateCapitalParts } from '../../src/core/enemies/capital-parts';

/**
 * The capital ship's parts (spec section 5): 8 turret mounts (6 rapid-fire, 2 heavy), 2 engines, 5
 * armour plates (four ring the core, one guards the bridge), a bridge and the core. Owned by track C.
 *
 * Coordinates are in ship space (x forward, y left, u) for a hull of `CAPITAL_DESIGN_RADIUS`; the
 * game scales them with the `hullRadius` tuning. Every number here is a starting default to tune:
 * - hp: the player's gun does 1 per bullet at 22 shots/s, a missile 4. The core path (four plates and
 *   the core) is 370 hp, the whole ship about 760.
 * - Shielding: the core cannot be damaged while any of its four plates stands; the bow plate shields
 *   the bridge the same way. Covered parts cannot be hit or locked at all.
 * - Turrets: rapid-fire ones fire short bursts with a pause (a window to fly through); the heavy
 *   ones are slower and reach farther, and fire a double slug per shot (bulletDamage 2 = two
 *   enemy bullets, each takes 1 hull). Arcs are wide but leave blind spots ahead and astern.
 */
export const CAPITAL_DESIGN_RADIUS = 700;

/** A turret mount at the part's own position (muzzle = part centre). `side` +1 = port (left), -1 = starboard. */
function mount(
  id: string,
  x: number,
  y: number,
  arcCenterDeg: number,
  arcHalfDeg: number,
  gun: Pick<
    WeaponMount,
    'fireRate' | 'bulletSpeed' | 'bulletDamage' | 'bulletLife' | 'range' | 'spread' | 'burst'
  >,
): WeaponMount {
  return { id, x, y, arcCenter: arcCenterDeg * DEG, arcHalf: arcHalfDeg * DEG, ...gun };
}

/** Rapid-fire gun: 3.5 shots/s in bursts of 6 with a 2.5 s pause. */
const RAPID = {
  fireRate: 3.5,
  bulletSpeed: 650,
  bulletDamage: 1,
  bulletLife: 2.2,
  range: 1300,
  spread: 4 * DEG,
  burst: { shots: 6, pause: 2.5 },
} as const;

/** Heavy gun: slow, long range, a double slug in bursts of 3 with a 4 s pause. */
const HEAVY = {
  fireRate: 0.9,
  bulletSpeed: 480,
  bulletDamage: 2,
  bulletLife: 3.6,
  range: 1700,
  spread: 1.5 * DEG,
  burst: { shots: 3, pause: 4 },
} as const;

function rapid(id: string, x: number, y: number, arcCenter: number): CapitalPartDef {
  return {
    id,
    role: 'turret',
    x,
    y,
    radius: 40,
    hp: 18,
    covers: [],
    mount: mount(`${id}-gun`, x, y, arcCenter, 110, RAPID),
  };
}

function heavy(id: string, x: number, y: number, arcCenter: number): CapitalPartDef {
  return {
    id,
    role: 'turret',
    x,
    y,
    radius: 55,
    hp: 36,
    covers: [],
    mount: mount(`${id}-gun`, x, y, arcCenter, 80, HEAVY),
  };
}

export const CAPITAL_PARTS: readonly CapitalPartDef[] = [
  // The core: killing it wins the battle. Four plates ring it.
  { id: 'core', role: 'core', x: 0, y: 0, radius: 65, hp: 90, covers: [] },
  {
    id: 'plate-front',
    role: 'armour',
    x: 100,
    y: 0,
    radius: 75,
    hp: 70,
    covers: ['core'],
  },
  {
    id: 'plate-aft',
    role: 'armour',
    x: -100,
    y: 0,
    radius: 75,
    hp: 70,
    covers: ['core'],
  },
  {
    id: 'plate-port',
    role: 'armour',
    x: 0,
    y: 105,
    radius: 48,
    length: 170,
    hp: 70,
    covers: ['core'],
  },
  {
    id: 'plate-starboard',
    role: 'armour',
    x: 0,
    y: -105,
    radius: 48,
    length: 170,
    hp: 70,
    covers: ['core'],
  },
  // The bridge, behind its own bow plate: killing it blinds the guns.
  { id: 'bridge', role: 'bridge', x: 330, y: 0, radius: 55, hp: 35, covers: [] },
  { id: 'plate-bow', role: 'armour', x: 430, y: 0, radius: 75, hp: 45, covers: ['bridge'] },
  // Engines at the stern: both dead = a sitting hulk.
  {
    id: 'engine-port',
    role: 'engine',
    x: -520,
    y: 160,
    radius: 48,
    length: 110,
    hp: 45,
    covers: [],
  },
  {
    id: 'engine-starboard',
    role: 'engine',
    x: -520,
    y: -160,
    radius: 48,
    length: 110,
    hp: 45,
    covers: [],
  },
  // Turrets: six rapid-fire and two heavy. Arcs are given relative to the heading (degrees).
  rapid('gun-bow-port', 250, 190, 60),
  rapid('gun-bow-starboard', 250, -190, -60),
  rapid('gun-mid-port', -30, 285, 90),
  rapid('gun-mid-starboard', -30, -285, -90),
  rapid('gun-aft-port', -300, 210, 120),
  rapid('gun-aft-starboard', -300, -210, -120),
  heavy('heavy-port', 140, 330, 90),
  heavy('heavy-starboard', 140, -330, -90),
];

// A bad ship fails at load, not mid-battle (the hull radius it is designed for).
validateCapitalParts(CAPITAL_PARTS, CAPITAL_DESIGN_RADIUS);
