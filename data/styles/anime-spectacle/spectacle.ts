import type { SpectacleDef } from '../../../src/render/spectacle-contract';

/**
 * The render-only extras of this pack. Every number has a range in `spectacle-contract.ts`; the
 * panel's Spectacle section edits them live.
 */
export const spectacle: SpectacleDef = {
  // Bloom on the emissives (engines, shots, blasts), a faint laser-disc fringe, soft vignette.
  post: {
    bloom: { strength: 0.9, radius: 0.6, threshold: 0.97 },
    chromatic: { base: 0.18, hit: 0.9, decay: 0.45 },
    vignette: 0.32,
    grain: 0.1,
    scanlines: 0.1,
    punch: 0.8,
  },
  // Ships with presence: plumes that follow the throttle, nav lights, trails, a helix streak on the
  // evade roll, curling missile smoke with launch flashes, and snapping lock-on brackets.
  ships: {
    plume: { length: 1.7, width: 0.2, idle: 0.35, flicker: 0.8, shimmer: 0.7 },
    navLights: { size: 5, blinkHz: 1.2, port: 0xff3050, starboard: 0x30ff90, strobe: 0xffffff },
    trails: { life: 0.9, width: 5, alpha: 0.8, from: 0.55 },
    rollStreak: { length: 320, alpha: 0.85 },
    missiles: { spirals: 2, amplitude: 16, smokeLife: 1.6, flash: 60 },
    brackets: { size: 1.6, color: 0xffd23f },
  },
  // One sky per battle of a run (cycling): a cobalt ringed planet, a crimson rift with a carrier,
  // an emerald veil around a colony ring, then golden ash. Practice mode uses the first.
  backdrop: {
    palettes: [
      {
        name: 'Indigo Frontier',
        sky: 0x050818,
        nebulaA: 0x2b3ea8,
        nebulaB: 0x7a2fb0,
        star: 0xc4d2ff,
        glow: 0xffb86b,
        structure: 'planet',
        structureColor: 0x4a7bd6,
      },
      {
        name: 'Crimson Rift',
        sky: 0x12050f,
        nebulaA: 0xb02a4a,
        nebulaB: 0xff7a3a,
        star: 0xffd0c0,
        glow: 0xff5a3a,
        structure: 'carrier',
        structureColor: 0x9aa8c8,
      },
      {
        name: 'Emerald Veil',
        sky: 0x04120f,
        nebulaA: 0x1fa87a,
        nebulaB: 0x2a6fd0,
        star: 0xc0ffe8,
        glow: 0x7affc8,
        structure: 'ring',
        structureColor: 0x7ad6b0,
      },
      {
        name: 'Golden Ash',
        sky: 0x120c06,
        nebulaA: 0xa06a1c,
        nebulaB: 0x6a2a20,
        star: 0xffe9b8,
        glow: 0xffe07a,
        structure: 'planet',
        structureColor: 0xd0a050,
      },
    ],
    nebula: { layers: 3, strength: 0.42, scale: 2600, drift: 12 },
    stars: { extraLayers: 3, twinkle: 0.55 },
    debris: { count: 40, size: [14, 70], depth: 0.8 },
    flashes: { rate: 1.2, size: 260 },
    shift: 3,
  },
};
