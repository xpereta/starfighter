import { defaultsOf, type ParamDef } from '../../src/core/params/params';

/** Flight tuning. Units: world units (u), seconds (s); angles in degrees here, radians inside core. */
export const flightParams = {
  minSpeed: {
    default: 120,
    min: 60,
    max: 250,
    unit: 'u/s',
    note: 'Slowest the ship can fly; it can never stop. Higher = always fast and harder to turn tightly; lower = more time crawling, with more control.',
  },
  cruiseSpeed: {
    default: 220,
    min: 100,
    max: 350,
    unit: 'u/s',
    note: 'Speed the ship settles at when you leave the throttle alone. Higher = faster default pace; lower = calmer pace with more room to boost.',
  },
  maxSpeed: {
    default: 360,
    min: 250,
    max: 600,
    unit: 'u/s',
    note: 'Top speed at full throttle. Higher = faster, with a wider camera and longer turns; lower = less difference between slow and fast.',
  },
  cruiseReturnRate: {
    default: 60,
    min: 10,
    max: 200,
    unit: 'u/s²',
    note: 'How fast speed drifts back to cruise when you release the throttle. Higher = snaps back quickly; lower = you keep a boost or brake for longer.',
  },
  accel: {
    default: 180,
    min: 50,
    max: 500,
    unit: 'u/s²',
    note: 'How fast speed rises while accelerating. Higher = boosts feel instant; lower = heavy, slow to build speed.',
  },
  brake: {
    default: 240,
    min: 50,
    max: 500,
    unit: 'u/s²',
    note: 'How fast speed drops while braking. Higher = sharp stops, easy to slow into a turn; lower = long, floaty braking.',
  },
  maxTurnRate: {
    default: 200,
    min: 60,
    max: 400,
    unit: '°/s',
    note: 'Tightest turn the ship can make, reached at corner speed. Higher = nimble, twitchy ship; lower = wide, heavy turns.',
  },
  cornerSpeed: {
    default: 180,
    min: 100,
    max: 350,
    unit: 'u/s',
    note: 'Speed where the ship turns best. Faster or slower than this makes turns wider. Moving it shifts the sweet spot along the speed bar.',
  },
  turnRateAtMin: {
    default: 150,
    min: 60,
    max: 400,
    unit: '°/s',
    note: 'Turn rate at the slowest speed. Higher = you can still pivot when nearly slow; lower = slow flight turns sluggishly.',
  },
  turnRateAtMax: {
    default: 110,
    min: 40,
    max: 400,
    unit: '°/s',
    note: 'Turn rate at top speed. Higher = boosting costs little agility; lower = full speed forces wide arcs, so slowing down to turn pays off.',
  },
  turnAccel: {
    default: 1200,
    min: 200,
    max: 4000,
    unit: '°/s²',
    note: 'How quickly the turn rate ramps up and down. Higher = instant, twitchy response; lower = smooth, weighty turns that take a moment to start and stop.',
  },
  grip: {
    default: 6,
    min: 1,
    max: 20,
    unit: '1/s',
    note: 'How fast the ship velocity turns to follow its nose. Higher = glued to the nose, like on rails; lower = drifts sideways through turns.',
  },
  gripAtMaxSpeed: {
    default: 4,
    min: 1,
    max: 20,
    unit: '1/s',
    note: 'Grip at top speed (it blends from Grip at low speed). Lower than Grip = fast flight slides more; equal = the same feel at every speed.',
  },
  arenaRadius: {
    default: 6000,
    min: 1000,
    max: 20000,
    unit: 'u',
    note: 'Size of the play area. Past it a soft force turns the ship back and a warning shows. Higher = more room before the edge; lower = a tighter arena.',
  },
  steerGain: {
    default: 6,
    min: 1,
    max: 20,
    unit: '1/s',
    note: 'In point-to-steer, how hard the ship turns toward the stick direction. Higher = snaps to where you point; lower = eases around gently (the turn-rate limit still applies).',
  },
  boundaryTurnGain: {
    default: 6,
    min: 1,
    max: 20,
    unit: '1/s',
    note: 'How hard the ship turns back toward the arena center after leaving it. Higher = a sharp U-turn; lower = a wide, lazy return.',
  },
  evadeTime: {
    default: 0.45,
    min: 0.2,
    max: 1,
    unit: 's',
    note: 'How long the evade roll lasts. Higher = a longer, more committal roll; lower = a quick flick.',
  },
  evadeOffset: {
    default: 90,
    min: 0,
    max: 300,
    unit: 'u',
    note: 'Sideways distance moved during the evade (sidestep variant). Higher = dodges farther; lower = barely moves sideways.',
  },
  evadeIFrames: {
    default: 0.3,
    min: 0,
    max: 0.8,
    unit: 's',
    note: 'How long at the start of the roll you cannot be hit. Higher = more forgiving; lower = riskier timing. Longer than Evade time has no extra effect.',
  },
  evadeCooldown: {
    default: 2,
    min: 0.5,
    max: 5,
    unit: 's',
    note: 'Wait before the next evade, counted from the start of the last one. Higher = evade is a rare resource; lower = you can nearly spam it.',
  },
  evadeSpeedBonus: {
    default: 0.15,
    min: 0,
    max: 0.5,
    unit: '',
    note: 'Extra speed during the roll, as a fraction of current speed. Higher = the roll doubles as a burst of speed; 0 = no speed change.',
  },
  evadeBreakTurnBoost: {
    default: 1.6,
    min: 1,
    max: 3,
    unit: '×',
    note: 'Only for the no-sidestep variant: turn-rate multiplier during the roll. Higher = a tighter break turn; 1 = no extra turning.',
  },
  evadeStickThreshold: {
    default: 0.3,
    min: 0,
    max: 1,
    unit: '',
    note: 'How far you must push the stick to choose the evade side (otherwise it goes left). Higher = a deliberate push is needed; lower = a tiny nudge picks the side.',
  },
  throttleDeadband: {
    default: 0.05,
    min: 0,
    max: 0.3,
    unit: '',
    note: 'Throttle values below this count as no throttle. Higher = a resting trigger or worn stick causes no speed drift; lower = more sensitive, may creep.',
  },
} as const satisfies Record<string, ParamDef>;

export type SteeringScheme = 'point' | 'rotate';

export type FlightConfig = { -readonly [K in keyof typeof flightParams]: number } & {
  /** A: point-to-steer (default). B: rotate. */
  steering: SteeringScheme;
  /** Evade variant: true = sidestep + i-frames; false = only i-frames + a tight break turn. */
  evadeSidestep: boolean;
};

export function createFlightConfig(): FlightConfig {
  return { ...defaultsOf(flightParams), steering: 'point', evadeSidestep: true };
}
