import { defaultsOf, type ParamDef } from '../../src/core/params/params';

/** HUD tuning. Pixel values are CSS pixels on screen; ranges are world units. */
export const hudParams = {
  edgeMargin: {
    default: 30,
    min: 10,
    max: 100,
    unit: 'px',
    note: 'Distance of the off-screen arrows from the screen edge. Higher = arrows sit farther inside; lower = they hug the edge.',
  },
  edgeSizeMin: {
    default: 10,
    min: 4,
    max: 40,
    unit: 'px',
    note: 'Arrow size for the farthest targets. Higher = distant targets stay easy to spot; lower = they fade into the background.',
  },
  edgeSizeMax: {
    default: 24,
    min: 4,
    max: 60,
    unit: 'px',
    note: 'Arrow size for the nearest targets. Higher = close threats stand out strongly; lower = all arrows look similar.',
  },
  edgeOpacityMin: {
    default: 0.3,
    min: 0.05,
    max: 1,
    unit: '',
    note: 'How see-through the arrow of the farthest target is. Higher = distant arrows stay clear; lower = they almost disappear.',
  },
  edgeRange: {
    default: 5000,
    min: 1000,
    max: 20000,
    unit: 'u',
    note: 'Distance at which an arrow reaches its smallest size and faintest look. Higher = arrows keep growing over a longer approach; lower = only very near targets stand out.',
  },
  warningBlinkHz: {
    default: 3,
    min: 1,
    max: 10,
    unit: 'Hz',
    note: 'How fast the leave-arena warning blinks. Higher = frantic; lower = a calm pulse.',
  },
} as const satisfies Record<string, ParamDef>;

export type HudConfig = { -readonly [K in keyof typeof hudParams]: number };

export function createHudConfig(): HudConfig {
  return defaultsOf(hudParams);
}
