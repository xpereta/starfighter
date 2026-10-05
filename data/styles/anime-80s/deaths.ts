import type { DeathDefs } from '../../../src/render/style';

/**
 * Death sequences. Each death rolls its own pieces, delays, sizes and directions from these ranges
 * (see the spec, section 4). Sizes are in ship radii; times in seconds; speeds in u/s.
 * `consume` is the chance a blast on a piece destroys it, `chain` the chance it sets off a neighbour.
 */
export const deaths: DeathDefs = {
  // Enemy fighter: breaks into a handful of pieces, a few small bursts, a smoking wreck.
  fighter: {
    pieces: [4, 7],
    primary: { kind: 'large', size: 2 },
    secondary: [
      {
        kind: 'small',
        count: [2, 4],
        size: [0.5, 0.9],
        delay: [0.15, 1.1],
        attach: 'piece',
        consume: 0.6,
        chain: 0.3,
      },
      {
        kind: 'small',
        count: [0, 2],
        size: [0.4, 0.7],
        delay: [0.3, 0.9],
        attach: 'wreck',
        consume: 0,
        chain: 0,
      },
    ],
    debris: { life: [1.8, 3.2], drift: [60, 170], spin: 5, fade: 0.5, trail: 3 },
    blow: 0.5,
    momentum: 0.6,
    hitStop: 0.04,
  },
  // Drone: quick and light.
  drone: {
    pieces: [3, 5],
    primary: { kind: 'small', size: 1.9 },
    secondary: [
      {
        kind: 'small',
        count: [1, 2],
        size: [0.6, 1],
        delay: [0.1, 0.5],
        attach: 'piece',
        consume: 0.7,
        chain: 0.2,
      },
    ],
    debris: { life: [1.2, 2.2], drift: [50, 130], spin: 7, fade: 0.5, trail: 0 },
    blow: 0.5,
    momentum: 0.5,
    hitStop: 0,
  },
  // Turret: heavy and slow, a long chain of blasts and a final burst (Yamato-style).
  turret: {
    pieces: [6, 9],
    primary: { kind: 'large', size: 2.2 },
    secondary: [
      {
        kind: 'small',
        count: [3, 5],
        size: [0.5, 1],
        delay: [0.2, 2],
        attach: 'piece',
        consume: 0.5,
        chain: 0.4,
      },
      {
        kind: 'large',
        count: [1, 1],
        size: [1.1, 1.4],
        delay: [0.8, 1.3],
        attach: 'wreck',
        consume: 0,
        chain: 0,
      },
    ],
    debris: { life: [2.5, 4.5], drift: [30, 90], spin: 3, fade: 0.5, trail: 2 },
    blow: 0.2,
    momentum: 0,
    finalBlast: { kind: 'heavy', size: 2.4, delay: 1.8 },
    hitStop: 0.08,
  },
  // Static target: crystal that shatters.
  static: {
    pieces: [4, 6],
    primary: { kind: 'large', size: 1.8 },
    secondary: [
      {
        kind: 'small',
        count: [1, 3],
        size: [0.4, 0.9],
        delay: [0.2, 1.2],
        attach: 'piece',
        consume: 0.6,
        chain: 0.2,
      },
    ],
    debris: { life: [1.5, 3], drift: [40, 110], spin: 4, fade: 0.5, trail: 1 },
    blow: 0.3,
    momentum: 0,
    hitStop: 0.03,
  },
  // Wingman: a heavier, more dramatic break-up with a closing blast.
  wingman: {
    pieces: [5, 8],
    primary: { kind: 'heavy', size: 2.4 },
    secondary: [
      {
        kind: 'small',
        count: [3, 5],
        size: [0.5, 0.9],
        delay: [0.2, 1.6],
        attach: 'piece',
        consume: 0.6,
        chain: 0.4,
      },
    ],
    debris: { life: [2.5, 4], drift: [70, 180], spin: 5, fade: 0.5, trail: 3 },
    blow: 0.5,
    momentum: 0.7,
    finalBlast: { kind: 'large', size: 2, delay: 1.4 },
    hitStop: 0.1,
  },
  // Player: the heaviest sequence (kept ready for when the player can be shot down).
  player: {
    pieces: [6, 9],
    primary: { kind: 'heavy', size: 2 },
    secondary: [
      {
        kind: 'small',
        count: [4, 6],
        size: [0.4, 0.8],
        delay: [0.2, 2],
        attach: 'piece',
        consume: 0.5,
        chain: 0.4,
      },
      {
        kind: 'large',
        count: [1, 2],
        size: [0.8, 1.2],
        delay: [0.6, 1.6],
        attach: 'wreck',
        consume: 0,
        chain: 0,
      },
    ],
    debris: { life: [3, 5], drift: [60, 160], spin: 4, fade: 0.5, trail: 3 },
    blow: 0.4,
    momentum: 0.8,
    finalBlast: { kind: 'heavy', size: 2.6, delay: 2 },
    hitStop: 0.12,
  },
  // Escape pod: a small pop.
  pod: {
    pieces: [2, 3],
    primary: { kind: 'small', size: 1.6 },
    secondary: [],
    debris: { life: [1, 1.8], drift: [40, 90], spin: 6, fade: 0.5, trail: 0 },
    blow: 0.3,
    momentum: 0.3,
    hitStop: 0,
  },
};
