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
} as const satisfies Record<string, ParamDef>;

export type QualitySettings = { -readonly [K in keyof typeof qualityParams]: number };
export type QualityLevel = 'low' | 'medium' | 'high';

export const qualityPresets: Record<QualityLevel, QualitySettings> = {
  low: { shardsMin: 3, shardsMax: 4, shardLife: 0.8, shardCap: 100 },
  medium: { shardsMin: 3, shardsMax: 5, shardLife: 1.1, shardCap: 250 },
  high: { shardsMin: 3, shardsMax: 5, shardLife: 1.4, shardCap: 500 },
};

// Fail loudly at load if a preset is out of range.
for (const [level, preset] of Object.entries(qualityPresets)) {
  for (const key of Object.keys(qualityParams) as (keyof QualitySettings)[]) {
    validateParam(`${level}.${key}`, qualityParams[key], preset[key]);
  }
}
