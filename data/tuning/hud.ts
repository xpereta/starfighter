import { defaultsOf, type ParamDef } from '../../src/core/params/params';

/** HUD tuning. Pixel values are CSS pixels on screen; ranges are world units. */
export const hudParams = {
  edgeMargin: { default: 30, min: 10, max: 100, unit: 'px (arrow inset from the screen edge)' },
  edgeSizeMin: { default: 10, min: 4, max: 40, unit: 'px (farthest target)' },
  edgeSizeMax: { default: 24, min: 4, max: 60, unit: 'px (nearest target)' },
  edgeOpacityMin: { default: 0.3, min: 0.05, max: 1, unit: 'fraction (farthest target)' },
  edgeRange: {
    default: 5000,
    min: 1000,
    max: 20000,
    unit: 'u (distance where an arrow is smallest)',
  },
  warningBlinkHz: { default: 3, min: 1, max: 10, unit: 'blinks/s' },
} as const satisfies Record<string, ParamDef>;

export type HudConfig = { -readonly [K in keyof typeof hudParams]: number };

export function createHudConfig(): HudConfig {
  return defaultsOf(hudParams);
}
