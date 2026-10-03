import { defaultsOf, type ParamDef } from '../../src/core/params/params';

/** Camera tuning. Units: world units (u), seconds (s). `view*` are visible widths on the 1280x800 reference. */
export const cameraParams = {
  viewMin: { default: 1600, min: 800, max: 3000, unit: 'u' },
  viewMax: { default: 2600, min: 1000, max: 4500, unit: 'u' },
  zoomLerp: { default: 2, min: 0.5, max: 8, unit: '1/s' },
  lookAhead: { default: 0.3, min: 0, max: 1, unit: 'half-widths at max speed' },
  lookAheadMax: { default: 0.3, min: 0, max: 0.5, unit: 'half-widths (cap)' },
  lookLerp: { default: 3, min: 0.5, max: 10, unit: '1/s' },
  safeFrame: { default: 0.15, min: 0.05, max: 0.3, unit: 'fraction of screen' },
  shake: { default: 6, min: 0, max: 40, unit: 'u' },
  shakeDecay: { default: 4, min: 1, max: 20, unit: '1/s' },
} as const satisfies Record<string, ParamDef>;

export type LookMode = 'velocity' | 'nose';

export type CameraConfig = { [K in keyof typeof cameraParams]: number } & {
  /** Look-ahead direction: where the ship is moving, or where the nose points. */
  lookMode: LookMode;
  shakeEnabled: boolean;
};

export function createCameraConfig(): CameraConfig {
  return { ...defaultsOf(cameraParams), lookMode: 'velocity', shakeEnabled: false };
}
