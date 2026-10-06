import type { ExplosionDefs } from '../../../src/render/style';

/**
 * Explosions in the used-future idiom: fireballs, not cel rings. A white-hot core falling through
 * sodium orange and ember red into sooty smoke (the last colour is the smoke), sparks as thin
 * spikes, almost no shockwave ring, and a quick flash only on the big ones.
 */
export const explosions: ExplosionDefs = {
  hitSpark: {
    size: 14,
    duration: 0.12,
    ramp: [0xfff4d0, 0xffb347, 0xff6a1e],
    layers: 1,
    ring: 0,
    puffs: 0,
    spikes: 7,
    cross: 0,
    flashFrames: 0,
  },
  small: {
    size: 30,
    duration: 0.55,
    ramp: [0xfff0c8, 0xffa63a, 0xd9501a, 0x2a2420],
    layers: 2,
    ring: 0,
    puffs: 3,
    spikes: 5,
    cross: 0,
    flashFrames: 0,
  },
  large: {
    size: 70,
    duration: 1.3,
    ramp: [0xfffbe8, 0xffc060, 0xe8601c, 0x2b2622],
    layers: 3,
    ring: 0.15,
    puffs: 6,
    spikes: 8,
    cross: 0,
    flashFrames: 1,
  },
  missile: {
    size: 42,
    duration: 0.6,
    ramp: [0xffffff, 0xffd070, 0xff7a2a, 0x2e2924],
    layers: 2,
    ring: 0.1,
    puffs: 3,
    spikes: 6,
    cross: 0,
    flashFrames: 0,
  },
  heavy: {
    size: 130,
    duration: 2.2,
    ramp: [0xffffff, 0xffd890, 0xff7a2a, 0x2a2420],
    layers: 3,
    ring: 0.25,
    puffs: 8,
    spikes: 12,
    cross: 0.2,
    flashFrames: 3,
  },
};
