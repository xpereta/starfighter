import type { DeathDefs } from '../../../src/render/style';

/**
 * Plain has no death sequences for ordinary ships (today's random shards and sparks), but the
 * capital ship (prototype 5, track C) is a boss: each of its parts and its hull get a sequence as
 * data. Plain defines no explosions, so these show the breaking pieces and drifting wreckage; a
 * style with explosions (anime-80s) adds the blasts on top of the same sequences.
 */
export const deaths: DeathDefs = {
  // The hull: breaks into big pieces over several seconds with a chain of blasts and a huge last one.
  capital: {
    pieces: [16, 22],
    primary: { kind: 'heavy', size: 1.2 },
    secondary: [
      {
        kind: 'large',
        count: [6, 10],
        size: [0.15, 0.35],
        delay: [0.2, 3],
        attach: 'piece',
        consume: 0.7,
        chain: 0.5,
      },
      {
        kind: 'heavy',
        count: [3, 5],
        size: [0.2, 0.4],
        delay: [0.5, 3.5],
        attach: 'wreck',
        consume: 0,
        chain: 0,
      },
      {
        kind: 'small',
        count: [6, 8],
        size: [0.1, 0.2],
        delay: [0.1, 2.5],
        attach: 'piece',
        consume: 0.5,
        chain: 0.4,
      },
    ],
    debris: { life: [3, 6], drift: [40, 140], spin: 1.2, fade: 0.5, trail: 4 },
    blow: 0.3,
    momentum: 0.2,
    finalBlast: { kind: 'heavy', size: 1.6, delay: 3.5 },
    hitStop: 0.12,
  },
  capitalTurret: {
    pieces: [3, 5],
    primary: { kind: 'large', size: 1.6 },
    secondary: [
      {
        kind: 'small',
        count: [1, 3],
        size: [0.4, 0.8],
        delay: [0.1, 0.8],
        attach: 'piece',
        consume: 0.6,
        chain: 0.2,
      },
    ],
    debris: { life: [1.5, 3], drift: [40, 120], spin: 5, fade: 0.5, trail: 2 },
    blow: 0.5,
    momentum: 0.3,
    hitStop: 0,
  },
  // Engine: a burning wreck, small blasts keep going off where it was.
  capitalEngine: {
    pieces: [3, 6],
    primary: { kind: 'heavy', size: 1.6 },
    secondary: [
      {
        kind: 'small',
        count: [3, 5],
        size: [0.4, 0.8],
        delay: [0.2, 1.6],
        attach: 'wreck',
        consume: 0,
        chain: 0,
      },
    ],
    debris: { life: [2, 3.5], drift: [30, 90], spin: 3, fade: 0.5, trail: 5 },
    blow: 0.4,
    momentum: 0.3,
    hitStop: 0,
  },
  capitalArmour: {
    pieces: [3, 5],
    primary: { kind: 'large', size: 1.3 },
    secondary: [],
    debris: { life: [1.5, 3], drift: [30, 90], spin: 3, fade: 0.5, trail: 0 },
    blow: 0.5,
    momentum: 0.3,
    hitStop: 0,
  },
  capitalBridge: {
    pieces: [4, 6],
    primary: { kind: 'large', size: 2 },
    secondary: [
      {
        kind: 'large',
        count: [1, 2],
        size: [0.5, 0.9],
        delay: [0.2, 1],
        attach: 'piece',
        consume: 0.5,
        chain: 0.3,
      },
    ],
    debris: { life: [2, 3.5], drift: [50, 130], spin: 4, fade: 0.5, trail: 2 },
    blow: 0.5,
    momentum: 0.3,
    hitStop: 0.05,
  },
  // The core: the last thing to go before the chain; a big blast and a flash.
  capitalCore: {
    pieces: [6, 10],
    primary: { kind: 'heavy', size: 2.2 },
    secondary: [
      {
        kind: 'large',
        count: [2, 4],
        size: [0.5, 1],
        delay: [0.1, 0.9],
        attach: 'piece',
        consume: 0.6,
        chain: 0.4,
      },
    ],
    debris: { life: [2, 4], drift: [60, 160], spin: 4, fade: 0.5, trail: 3 },
    blow: 0.4,
    momentum: 0.3,
    finalBlast: { kind: 'heavy', size: 2.5, delay: 0.4 },
    hitStop: 0.1,
  },
};
