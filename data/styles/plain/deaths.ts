import type { DeathDefs } from '../../../src/render/style';

/**
 * Death sequences. Plain keeps today's random shards and sparks for the old kinds; the gunship
 * (prototype 5) gets a first placeholder sequence: it breaks into a handful of big pieces with
 * a chain of blasts and a final burst. Packs without their own gunship death use this one.
 * Sizes are in ship radii, times in seconds, speeds in u/s (see `DeathDef` in `render/style.ts`).
 */
export const deaths: DeathDefs = {
  gunship: {
    pieces: [6, 9],
    primary: { kind: 'heavy', size: 2.2 },
    secondary: [
      {
        kind: 'small',
        count: [4, 7],
        size: [0.4, 0.8],
        delay: [0.2, 1.8],
        attach: 'piece',
        consume: 0.5,
        chain: 0.35,
      },
      {
        kind: 'large',
        count: [1, 2],
        size: [0.6, 1],
        delay: [0.6, 1.6],
        attach: 'wreck',
        consume: 0,
        chain: 0,
      },
    ],
    debris: { life: [2.2, 3.8], drift: [40, 130], spin: 3, fade: 0.5, trail: 3 },
    blow: 0.4,
    momentum: 0.6,
    finalBlast: { kind: 'large', size: 2.6, delay: 2 },
    hitStop: 0.08,
  },
};
