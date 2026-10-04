import { defaultsOf, type ParamDef } from '../../src/core/params/params';

/** Camera tuning. Units: world units (u), seconds (s). `view*` are visible widths on the 1280x800 reference. */
export const cameraParams = {
  viewMin: {
    default: 2050,
    min: 800,
    max: 3000,
    unit: 'u',
    note: 'Visible width when flying slowest. Higher = zoomed out even when slow; lower = closer and more detailed. Keeps below View max.',
  },
  viewMax: {
    default: 4500,
    min: 1000,
    max: 7800,
    unit: 'u',
    note: 'Visible width at top speed. Higher = zooms out more as you speed up (more warning, less detail); lower = less zoom change.',
  },
  zoomLerp: {
    default: 2,
    min: 0.5,
    max: 8,
    unit: '1/s',
    note: 'How fast the zoom follows speed changes. Higher = zoom reacts instantly and can feel nervous; lower = slow, smooth breathing.',
  },
  lookAhead: {
    default: 0.3,
    min: 0,
    max: 2,
    unit: '',
    note: 'How far the camera leans toward where you are heading as speed rises, in half screen widths. Higher = see farther ahead sooner, reaching the cap at lower speeds; lower = ship stays near the center. Never more than Look ahead max, and Safe frame still keeps the ship off the edge.',
  },
  lookAheadMax: {
    default: 0.3,
    min: 0,
    max: 1,
    unit: '',
    note: 'Hard cap on that lean, in half screen widths (1 = ship at the very edge). Higher = the ship can sit far from the center at speed; 0 = always centered. Safe frame still keeps the ship off the edge: for the strongest lean raise this and lower Safe frame.',
  },
  lookLerp: {
    default: 3,
    min: 0.5,
    max: 10,
    unit: '1/s',
    note: 'How fast the lean follows direction changes. Higher = the view snaps with every turn and can jerk; lower = a smooth drifting view that lags behind hard turns.',
  },
  safeFrame: {
    default: 0.15,
    min: 0.05,
    max: 0.3,
    unit: '',
    note: 'Margin from every screen edge that the ship is never allowed to enter, as a fraction of the screen. Higher = ship kept nearer the center; lower = it may get close to the edge.',
  },
  shake: {
    default: 16.6,
    min: 0,
    max: 40,
    unit: 'u',
    note: 'Strength of the screen shake on shots and hits (only when shake is switched on). Higher = violent; lower = subtle.',
  },
  shakeDecay: {
    default: 4,
    min: 1,
    max: 20,
    unit: '1/s',
    note: 'How quickly shake dies down. Higher = short jolts; lower = long rumbles.',
  },
} as const satisfies Record<string, ParamDef>;

export type LookMode = 'velocity' | 'nose';

export type CameraConfig = { -readonly [K in keyof typeof cameraParams]: number } & {
  /** Look-ahead direction: where the ship is moving, or where the nose points. */
  lookMode: LookMode;
  shakeEnabled: boolean;
};

export function createCameraConfig(): CameraConfig {
  return { ...defaultsOf(cameraParams), lookMode: 'nose', shakeEnabled: true };
}
