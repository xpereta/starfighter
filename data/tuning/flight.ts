import { defaultsOf, type ParamDef } from '../../src/core/params/params';

/** Flight tuning. Units: world units (u), seconds (s); angles in degrees here, radians inside core. */
export const flightParams = {
  minSpeed: { default: 120, min: 60, max: 250, unit: 'u/s' },
  cruiseSpeed: { default: 220, min: 100, max: 350, unit: 'u/s' },
  maxSpeed: { default: 360, min: 250, max: 600, unit: 'u/s' },
  cruiseReturnRate: { default: 60, min: 10, max: 200, unit: 'u/s²' },
  accel: { default: 180, min: 50, max: 500, unit: 'u/s²' },
  brake: { default: 240, min: 50, max: 500, unit: 'u/s²' },
  maxTurnRate: { default: 200, min: 60, max: 400, unit: '°/s' },
  cornerSpeed: { default: 180, min: 100, max: 350, unit: 'u/s' },
  turnRateAtMin: { default: 150, min: 60, max: 400, unit: '°/s' },
  turnRateAtMax: { default: 110, min: 40, max: 400, unit: '°/s' },
  turnAccel: { default: 1200, min: 200, max: 4000, unit: '°/s²' },
  grip: { default: 6, min: 1, max: 20, unit: '1/s' },
  gripAtMaxSpeed: { default: 4, min: 1, max: 20, unit: '1/s' },
  arenaRadius: { default: 6000, min: 1000, max: 20000, unit: 'u' },
  steerGain: { default: 6, min: 1, max: 20, unit: '1/s' },
  boundaryTurnGain: { default: 6, min: 1, max: 20, unit: '1/s' },
  evadeTime: { default: 0.45, min: 0.2, max: 1, unit: 's' },
  evadeOffset: { default: 90, min: 0, max: 300, unit: 'u (sideways)' },
  evadeIFrames: { default: 0.3, min: 0, max: 0.8, unit: 's invulnerable' },
  evadeCooldown: { default: 2, min: 0.5, max: 5, unit: 's (from the start of the evade)' },
  evadeSpeedBonus: { default: 0.15, min: 0, max: 0.5, unit: 'fraction of speed' },
  evadeBreakTurnBoost: { default: 1.6, min: 1, max: 3, unit: 'x turn rate (no-sidestep variant)' },
  evadeStickThreshold: {
    default: 0.3,
    min: 0,
    max: 1,
    unit: 'stick deflection that picks the side',
  },
  throttleDeadband: { default: 0.05, min: 0, max: 0.3, unit: 'fraction' },
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
