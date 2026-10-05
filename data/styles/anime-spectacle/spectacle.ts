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
};
