import type { ExplosionDefs } from '../../../src/render/style';

/**
 * The explosion vocabulary: flat, hard-edged shapes with a colour ramp from the hot core out to
 * the smoke (last colour). Sizes are the blast's peak radius in world units, used when a ship does
 * not set it (hit sparks, missile hits); death sequences size blasts in ship radii.
 */
export const explosions: ExplosionDefs = {
  // A sharp starburst, a few frames long.
  hitSpark: {
    size: 16,
    duration: 0.14,
    ramp: [0xffffff, 0xfff27a, 0xffa93a],
    layers: 1,
    ring: 0,
    puffs: 0,
    spikes: 8,
    cross: 0,
    flashFrames: 0,
  },
  // A small round flash with a thin ring: drones, pieces bursting.
  small: {
    size: 28,
    duration: 0.45,
    ramp: [0xfffbe0, 0xffd23f, 0xff6a2e, 0x4a2a5c],
    layers: 2,
    ring: 0.6,
    puffs: 2,
    spikes: 0,
    cross: 0,
    flashFrames: 0,
  },
  // A large layered burst with a shockwave ring and smoke puffs: fighters and turrets.
  large: {
    size: 64,
    duration: 0.95,
    ramp: [0xfffff0, 0xffd23f, 0xff5a2e, 0x3b2450],
    layers: 3,
    ring: 1,
    puffs: 5,
    spikes: 0,
    cross: 0,
    flashFrames: 2,
  },
  // A missile hit: cross flare over a small burst.
  missile: {
    size: 38,
    duration: 0.5,
    ramp: [0xffffff, 0xffe45e, 0xff8a3c, 0x3b2450],
    layers: 2,
    ring: 0.5,
    puffs: 2,
    spikes: 6,
    cross: 1,
    flashFrames: 0,
  },
  // Bigger and slower: wingmen, the player, final blasts.
  heavy: {
    size: 120,
    duration: 1.6,
    ramp: [0xffffff, 0xfff0a0, 0xff8a3c, 0x2e1a4a],
    layers: 3,
    ring: 1,
    puffs: 8,
    spikes: 12,
    cross: 0.6,
    flashFrames: 4,
  },
};
