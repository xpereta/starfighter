import { validateParam, type ParamDef } from '../src/core/params/params';
import type { QualityLevel } from './quality';

/**
 * Quality presets of the spectacle effects (eye candy only; gameplay never depends on them). The
 * level is chosen with `?fx=low|medium|high` (remembered per browser) or the panel's Spectacle
 * section. `low` is the fallback for weak devices: no post-processing, no shader clouds, small pools.
 */
export const spectacleQualityParams = {
  post: {
    default: 1,
    min: 0,
    max: 1,
    unit: '',
    note: 'Post-processing on (1) or off (0): bloom, colour fringe, vignette, grain. Off = the plain scene render, cheapest.',
  },
  bloomScale: {
    default: 0.5,
    min: 0.1,
    max: 1,
    unit: 'x',
    note: 'Resolution of the glow pass as a share of the screen. Lower = cheaper and softer.',
  },
  msaa: {
    default: 4,
    min: 0,
    max: 8,
    unit: 'samples',
    note: 'Edge smoothing of the post-processing target (0 = none). Lower = cheaper, jaggier edges.',
  },
  nebulaLayers: {
    default: 3,
    min: 0,
    max: 3,
    unit: 'layers',
    note: 'Most gas-cloud shader layers drawn (each is a full-screen pass). Lower = cheaper.',
  },
  extraStars: {
    default: 3,
    min: 0,
    max: 3,
    unit: 'layers',
    note: 'Most extra twinkling star layers.',
  },
  debris: {
    default: 64,
    min: 0,
    max: 64,
    unit: 'rocks',
    note: 'Most drifting background rocks.',
  },
  flashes: {
    default: 12,
    min: 0,
    max: 64,
    unit: 'flashes',
    note: 'Most distant battle flashes alive at once.',
  },
  ribbonPoints: {
    default: 24,
    min: 4,
    max: 64,
    unit: 'points',
    note: 'Points per trail ribbon (the longest a trail can be drawn smoothly).',
  },
  ribbons: {
    default: 48,
    min: 0,
    max: 256,
    unit: 'ribbons',
    note: 'Most trail ribbons at once (wingtips, engines, missile smoke).',
  },
  sparkCap: {
    default: 600,
    min: 0,
    max: 4000,
    unit: 'sparks',
    note: 'Most sparks and glints at once.',
  },
  blotCap: {
    default: 90,
    min: 0,
    max: 600,
    unit: 'blots',
    note: 'Most smoke ink-blots at once.',
  },
  ringCap: {
    default: 48,
    min: 0,
    max: 400,
    unit: 'rings',
    note: 'Most shock rings, flash frames and fireballs at once.',
  },
  queueCap: {
    default: 48,
    min: 0,
    max: 400,
    unit: 'blasts',
    note: 'Most delayed chain-reaction blasts waiting at once.',
  },
  tracers: {
    default: 1,
    min: 0,
    max: 1,
    unit: '',
    note: 'Glowing bullet tracers on (1) or off (0).',
  },
  cards: {
    default: 1,
    min: 0,
    max: 1,
    unit: '',
    note: 'Title cards and flourishes on (1) or off (0).',
  },
} as const satisfies Record<string, ParamDef>;

export type SpectacleQuality = { -readonly [K in keyof typeof spectacleQualityParams]: number };

export const spectacleQualityPresets: Record<QualityLevel, SpectacleQuality> = {
  low: {
    post: 0,
    bloomScale: 0.25,
    msaa: 0,
    nebulaLayers: 0,
    extraStars: 0,
    debris: 12,
    flashes: 4,
    ribbonPoints: 8,
    ribbons: 12,
    sparkCap: 120,
    blotCap: 20,
    ringCap: 12,
    queueCap: 10,
    tracers: 1,
    cards: 1,
  },
  medium: {
    post: 1,
    bloomScale: 0.35,
    msaa: 0,
    nebulaLayers: 2,
    extraStars: 1,
    debris: 28,
    flashes: 8,
    ribbonPoints: 14,
    ribbons: 28,
    sparkCap: 300,
    blotCap: 50,
    ringCap: 28,
    queueCap: 24,
    tracers: 1,
    cards: 1,
  },
  high: {
    post: 1,
    bloomScale: 0.5,
    msaa: 4,
    nebulaLayers: 3,
    extraStars: 3,
    debris: 64,
    flashes: 12,
    ribbonPoints: 24,
    ribbons: 48,
    sparkCap: 600,
    blotCap: 90,
    ringCap: 48,
    queueCap: 48,
    tracers: 1,
    cards: 1,
  },
};

for (const [level, preset] of Object.entries(spectacleQualityPresets)) {
  for (const key of Object.keys(spectacleQualityParams) as (keyof SpectacleQuality)[]) {
    validateParam(`spectacle.${level}.${key}`, spectacleQualityParams[key], preset[key]);
  }
}
