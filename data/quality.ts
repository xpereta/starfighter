import { validateParam, type ParamDef } from '../src/core/params/params';

/**
 * Quality presets: how much eye candy, never design values. Gameplay must not depend on these.
 * Counts and lifetimes only affect visuals (e.g. destruction shards).
 */
export const qualityParams = {
  shardsMin: {
    default: 3,
    min: 0,
    max: 20,
    unit: 'shards',
    note: 'Fewest shards a destroyed target breaks into. Higher = more debris on every kill; lower = cleaner screen and faster on weak devices.',
  },
  shardsMax: {
    default: 5,
    min: 0,
    max: 20,
    unit: 'shards',
    note: 'Most shards a destroyed target breaks into. Higher = richer explosions; lower = cheaper and calmer.',
  },
  shardLife: {
    default: 1.4,
    min: 0.2,
    max: 6,
    unit: 's',
    note: 'How long shards drift and fade. Higher = lingering debris; lower = they vanish quickly.',
  },
  shardCap: {
    default: 500,
    min: 10,
    max: 5000,
    unit: 'shards',
    note: 'Most shards on screen at once (the pool size). Higher = nothing is skipped in big fights but costs more memory; lower = new shards are skipped when full.',
  },
  pieceCap: {
    default: 160,
    min: 0,
    max: 2000,
    unit: 'pieces',
    note: 'Most broken-ship pieces (flying wreckage) on screen at once. Higher = big fights keep all their debris; lower = pieces are skipped when full and it is cheaper.',
  },
  explosionCap: {
    default: 96,
    min: 0,
    max: 1000,
    unit: 'blasts',
    note: 'Most explosions drawn at once (hit sparks, blasts, secondary explosions). Higher = nothing is skipped in a big fight; lower = new blasts are skipped when full.',
  },
  puffCap: {
    default: 200,
    min: 0,
    max: 2000,
    unit: 'puffs',
    note: 'Most smoke puffs trailing from pieces at once. Higher = thicker smoke trails; lower = cleaner and cheaper.',
  },
  pieceScale: {
    default: 1,
    min: 0.1,
    max: 1,
    unit: 'x',
    note: 'Share of the pieces a death sequence asks for that actually appear. 1 = all; lower = ships break into fewer, bigger pieces on weak devices.',
  },
  debrisLifeScale: {
    default: 1,
    min: 0.1,
    max: 3,
    unit: 'x',
    note: 'Multiplier on how long wreckage lingers. Higher = debris hangs around longer; lower = the screen clears faster.',
  },
  screenFx: {
    default: 1,
    min: 0,
    max: 1,
    unit: 'x',
    note: 'Strength of the screen effects (flash frames, hit-stop, speed lines). 1 = as the style asks; 0 = all off.',
  },
} as const satisfies Record<string, ParamDef>;

export type QualitySettings = { -readonly [K in keyof typeof qualityParams]: number };
export type QualityLevel = 'low' | 'medium' | 'high';

export const qualityPresets: Record<QualityLevel, QualitySettings> = {
  low: {
    shardsMin: 3,
    shardsMax: 4,
    shardLife: 0.8,
    shardCap: 100,
    pieceCap: 40,
    explosionCap: 24,
    puffCap: 40,
    pieceScale: 0.5,
    debrisLifeScale: 0.5,
    screenFx: 0,
  },
  medium: {
    shardsMin: 3,
    shardsMax: 5,
    shardLife: 1.1,
    shardCap: 250,
    pieceCap: 90,
    explosionCap: 48,
    puffCap: 100,
    pieceScale: 0.75,
    debrisLifeScale: 0.8,
    screenFx: 0.6,
  },
  high: {
    shardsMin: 3,
    shardsMax: 5,
    shardLife: 1.4,
    shardCap: 500,
    pieceCap: 160,
    explosionCap: 96,
    puffCap: 200,
    pieceScale: 1,
    debrisLifeScale: 1,
    screenFx: 1,
  },
};

// Fail loudly at load if a preset is out of range.
for (const [level, preset] of Object.entries(qualityPresets)) {
  for (const key of Object.keys(qualityParams) as (keyof QualitySettings)[]) {
    validateParam(`${level}.${key}`, qualityParams[key], preset[key]);
  }
}
