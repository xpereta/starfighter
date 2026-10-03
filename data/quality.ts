import { validateParam, type ParamDef } from '../src/core/params/params';

/**
 * Quality presets: how much eye candy, never design values. Gameplay must not depend on these.
 * Counts and lifetimes only affect visuals (e.g. destruction shards).
 */
export const qualityParams = {
  shardsMin: { default: 3, min: 0, max: 20, unit: 'shards per kill' },
  shardsMax: { default: 5, min: 0, max: 20, unit: 'shards per kill' },
  shardLife: { default: 1.4, min: 0.2, max: 6, unit: 's' },
  shardCap: { default: 500, min: 10, max: 5000, unit: 'shards on screen (pool)' },
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
