import { defaultsOf, type ParamDef } from '../../src/core/params/params';

/** Enemy fighter and wave tuning (spec: docs/specs/prototype-2-squadron.md section 3). Angles in degrees here. */
export const fighterParams = {
  waveSize: {
    default: 4,
    min: 0,
    max: 12,
    unit: 'fighters',
    note: 'How many enemy fighters arrive in each wave. 0 turns waves off, leaving only the drones and turrets. Higher = a busier, harder dogfight; lower = more room to practise.',
  },
  waveDelay: {
    default: 6,
    min: 1,
    max: 30,
    unit: 's',
    note: 'Pause between the last fighter of a wave going down and the next wave arriving. Higher = more breathing room; lower = relentless pressure.',
  },
  spawnFraction: {
    default: 0.9,
    min: 0.3,
    max: 1,
    unit: 'fraction',
    note: 'How far out a wave appears, as a share of the arena radius. Higher = they start at the edge and take longer to reach you; lower = they appear closer to the centre.',
  },
  health: {
    default: 3,
    min: 1,
    max: 10,
    unit: 'hp',
    note: 'Hit points of an enemy fighter. Each gun bullet takes one; a missile takes four. Higher = tougher fighters that need more shooting; lower = they drop quickly.',
  },
  radius: {
    default: 28,
    min: 10,
    max: 80,
    unit: 'u',
    note: 'Size of the fighter hit circle, used for bullets and lock-on. Higher = a bigger, easier target; lower = harder to hit.',
  },
  turnRateScale: {
    default: 0.85,
    min: 0.3,
    max: 1.5,
    unit: 'x',
    note: 'Enemy turn rate compared with yours. 0.85 means they turn 15% slower, so you can out-turn them. Higher = harder to get behind; lower = easy to dodge and out-turn.',
  },
  speedScale: {
    default: 0.9,
    min: 0.5,
    max: 1.2,
    unit: 'x',
    note: 'Enemy speed range compared with yours (top speed, cruise and corner speed). Higher = they keep up or outrun you; lower = you can run away or catch them easily.',
  },
  retargetInterval: {
    default: 1.5,
    min: 0.2,
    max: 10,
    unit: 's',
    note: 'How often a fighter re-picks the nearest of you and your wingmen to chase. Lower = jumpy, always going for the closest; higher = sticks with one target for longer.',
  },
  fireCone: {
    default: 7,
    min: 1,
    max: 30,
    unit: '°',
    note: 'How well a fighter must be pointing at its target before it shoots, as a half-angle. Higher = sprays from wider angles and is more dangerous; lower = only fires when well lined up.',
  },
  fireRange: {
    default: 900,
    min: 200,
    max: 3000,
    unit: 'u',
    note: 'Farthest distance at which a fighter shoots, and the distance it tries to close to. Higher = it shoots from afar; lower = it must get close before firing.',
  },
  fireRate: {
    default: 4,
    min: 0.5,
    max: 15,
    unit: 'shots/s',
    note: 'How fast a fighter fires its guns. Higher = a denser stream of bullets to dodge; lower = sparse, easy to avoid shots.',
  },
  bulletSpeed: {
    default: 600,
    min: 200,
    max: 1500,
    unit: 'u/s',
    note: 'Speed of enemy fighter bullets on top of the fighter own speed. Your bullets are faster (900). Higher = harder to dodge; lower = slow shots you can weave around.',
  },
  bulletLife: {
    default: 1.4,
    min: 0.3,
    max: 4,
    unit: 's',
    note: 'How long an enemy fighter bullet flies before it fades. Higher = shots reach farther and stay dangerous longer (and fill the shot pool); lower = short-range fire.',
  },
  spread: {
    default: 1.5,
    min: 0,
    max: 10,
    unit: '°',
    note: 'Random aim error of enemy fighter guns, as a maximum angle. Higher = inaccurate fire that often misses; lower = sharp, accurate shooting.',
  },
  muzzleOffset: {
    default: 40,
    min: 0,
    max: 120,
    unit: 'u',
    note: 'How far in front of its centre a fighter bullet appears. Mostly cosmetic: it keeps bullets from starting inside the ship.',
  },
  leadTimeMax: {
    default: 1.5,
    min: 0,
    max: 4,
    unit: 's',
    note: 'Longest time ahead a fighter aims when leading your movement. 0 = aims straight at where you are (easy to dodge by moving); higher = anticipates your path and punishes straight flying.',
  },
  minRange: {
    default: 250,
    min: 0,
    max: 1500,
    unit: 'u',
    note: 'Closer than this a fighter eases off the throttle instead of ramming you. Higher = it keeps its distance; lower = it flies right on top of you.',
  },
  hardTurnAngle: {
    default: 70,
    min: 20,
    max: 180,
    unit: '°',
    note: 'When the target is off the nose by more than this, the fighter brakes to its corner speed so it can turn tighter. Higher = it rarely slows down and swings wide; lower = it brakes into turns often.',
  },
  breakHitWindow: {
    default: 1,
    min: 0.2,
    max: 5,
    unit: 's',
    note: 'A fighter breaks away when it takes two hits within this time. Higher = it panics more easily; lower = you have to hit it twice in quick succession.',
  },
  breakTime: {
    default: 1.2,
    min: 0.3,
    max: 4,
    unit: 's',
    note: 'How long a break-away lasts: a hard turn away with an evade roll. Higher = it disengages for longer and is harder to finish; lower = it returns to the fight quickly.',
  },
  breakCooldown: {
    default: 3,
    min: 0,
    max: 15,
    unit: 's',
    note: 'After a break-away ends, how long before the fighter can break again, even if you keep it locked or hit it. Higher = it can be pinned down; lower = it keeps slipping away.',
  },
  breakAngle: {
    default: 110,
    min: 45,
    max: 170,
    unit: '°',
    note: 'How far off the line to its target a fighter turns during a break-away. Higher = it flees almost straight away from you; lower = it jinks sideways and stays close.',
  },
} as const satisfies Record<string, ParamDef>;

export type FighterConfig = { -readonly [K in keyof typeof fighterParams]: number };

export function createFighterConfig(): FighterConfig {
  return defaultsOf(fighterParams);
}
