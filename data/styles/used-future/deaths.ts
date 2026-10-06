import type {
  DeathDef,
  DeathDefs,
  ExplosionKind,
  Range,
  SecondaryDef,
} from '../../../src/render/style';

/**
 * Death sequences in the used-future idiom: the hull breaks along its own fracture lines, the
 * pieces tumble away slowly and keep burning (smoke trails, secondary fireballs on the pieces and on
 * the wreck), and the heavy craft end with one last blast. Debris lingers longer and drifts slower
 * than in the cel packs: heavy things in vacuum. Sizes in radii, times in seconds, speeds in u/s.
 */

const blast = (
  kind: ExplosionKind,
  count: Range,
  size: Range,
  delay: Range,
  attach: 'piece' | 'wreck',
  consume = 0.5,
  chain = 0.3,
): SecondaryDef => ({ kind, count, size, delay, attach, consume, chain });

const death = (d: DeathDef): DeathDef => d;

export const deaths: DeathDefs = {
  player: death({
    pieces: [7, 10],
    primary: { kind: 'heavy', size: 2 },
    secondary: [
      blast('small', [4, 6], [0.4, 0.8], [0.2, 2.4], 'piece', 0.5, 0.4),
      blast('large', [1, 2], [0.8, 1.2], [0.6, 1.8], 'wreck', 0, 0),
    ],
    debris: { life: [3.5, 6], drift: [40, 120], spin: 3, fade: 0.5, trail: 4 },
    blow: 0.4,
    momentum: 0.8,
    finalBlast: { kind: 'heavy', size: 2.6, delay: 2.2 },
    hitStop: 0.12,
  }),
  wingman: death({
    pieces: [6, 9],
    primary: { kind: 'heavy', size: 2.2 },
    secondary: [blast('small', [3, 5], [0.5, 0.9], [0.2, 1.8], 'piece', 0.6, 0.4)],
    debris: { life: [3, 5], drift: [50, 140], spin: 3.5, fade: 0.5, trail: 4 },
    blow: 0.5,
    momentum: 0.7,
    finalBlast: { kind: 'large', size: 2, delay: 1.5 },
    hitStop: 0.1,
  }),
  fighter: death({
    pieces: [5, 8],
    primary: { kind: 'large', size: 2 },
    secondary: [
      blast('small', [2, 4], [0.5, 0.9], [0.15, 1.2], 'piece', 0.6, 0.3),
      blast('small', [0, 2], [0.4, 0.7], [0.3, 1.0], 'wreck', 0, 0),
    ],
    debris: { life: [2.4, 4.2], drift: [40, 130], spin: 4, fade: 0.5, trail: 4 },
    blow: 0.5,
    momentum: 0.6,
    hitStop: 0.04,
  }),
  lancer: death({
    pieces: [5, 8],
    primary: { kind: 'large', size: 2.2 },
    secondary: [
      // The missile racks cook off.
      blast('missile', [2, 4], [0.5, 0.9], [0.2, 1.4], 'piece', 0.7, 0.5),
      blast('small', [1, 3], [0.4, 0.8], [0.3, 1.1], 'wreck', 0, 0),
    ],
    debris: { life: [2.4, 4.2], drift: [40, 140], spin: 4, fade: 0.5, trail: 4 },
    blow: 0.5,
    momentum: 0.6,
    hitStop: 0.05,
  }),
  drone: death({
    pieces: [3, 5],
    primary: { kind: 'small', size: 2 },
    secondary: [blast('small', [1, 2], [0.6, 1], [0.1, 0.6], 'piece', 0.7, 0.2)],
    debris: { life: [1.8, 3], drift: [35, 100], spin: 6, fade: 0.5, trail: 1 },
    blow: 0.5,
    momentum: 0.5,
    hitStop: 0,
  }),
  turret: death({
    pieces: [6, 9],
    primary: { kind: 'large', size: 2.2 },
    secondary: [
      blast('small', [3, 5], [0.5, 1], [0.2, 2], 'piece', 0.5, 0.4),
      blast('large', [1, 1], [1.1, 1.4], [0.8, 1.3], 'wreck', 0, 0),
    ],
    debris: { life: [3.5, 6], drift: [20, 70], spin: 2.5, fade: 0.5, trail: 3 },
    blow: 0.2,
    momentum: 0,
    finalBlast: { kind: 'heavy', size: 2.4, delay: 1.9 },
    hitStop: 0.08,
  }),
  static: death({
    pieces: [4, 6],
    primary: { kind: 'large', size: 1.8 },
    secondary: [blast('small', [1, 3], [0.4, 0.9], [0.2, 1.2], 'piece', 0.6, 0.2)],
    debris: { life: [2.4, 4], drift: [30, 90], spin: 3, fade: 0.5, trail: 2 },
    blow: 0.3,
    momentum: 0,
    hitStop: 0.03,
  }),
  pod: death({
    pieces: [2, 4],
    primary: { kind: 'small', size: 1.7 },
    secondary: [],
    debris: { life: [1.6, 2.6], drift: [30, 80], spin: 5, fade: 0.5, trail: 0 },
    blow: 0.3,
    momentum: 0.3,
    hitStop: 0,
  }),
  gunship: death({
    pieces: [9, 13],
    primary: { kind: 'heavy', size: 2.2 },
    secondary: [
      blast('small', [4, 6], [0.5, 1], [0.2, 2.6], 'piece', 0.5, 0.4),
      blast('large', [2, 3], [0.8, 1.2], [0.5, 2.4], 'piece', 0.6, 0.5),
      blast('large', [1, 1], [1, 1.4], [0.9, 1.6], 'wreck', 0, 0),
    ],
    debris: { life: [4, 7], drift: [30, 90], spin: 2.2, fade: 0.5, trail: 5 },
    blow: 0.3,
    momentum: 0.4,
    finalBlast: { kind: 'heavy', size: 3, delay: 2.6 },
    hitStop: 0.1,
  }),
  capital: death({
    pieces: [14, 20],
    primary: { kind: 'heavy', size: 2.4 },
    secondary: [
      blast('small', [6, 8], [0.4, 0.8], [0.3, 5], 'piece', 0.5, 0.5),
      blast('large', [3, 4], [0.6, 1], [0.8, 5.5], 'piece', 0.6, 0.6),
      blast('heavy', [1, 2], [0.8, 1.2], [1.5, 4], 'wreck', 0, 0),
    ],
    debris: { life: [5, 8], drift: [20, 60], spin: 1.2, fade: 0.4, trail: 6 },
    blow: 0.1,
    momentum: 0.2,
    finalBlast: { kind: 'heavy', size: 3.2, delay: 6.5 },
    hitStop: 0.2,
  }),
  capitalTurret: death({
    pieces: [5, 7],
    primary: { kind: 'large', size: 2 },
    secondary: [blast('small', [2, 4], [0.5, 1], [0.2, 1.4], 'piece', 0.6, 0.3)],
    debris: { life: [3, 5], drift: [20, 70], spin: 2.5, fade: 0.5, trail: 3 },
    blow: 0.3,
    momentum: 0.1,
    hitStop: 0.06,
  }),
  capitalEngine: death({
    pieces: [5, 8],
    primary: { kind: 'heavy', size: 2 },
    secondary: [blast('large', [1, 2], [0.8, 1.2], [0.3, 1.6], 'wreck', 0, 0)],
    debris: { life: [3, 6], drift: [20, 60], spin: 2, fade: 0.5, trail: 5 },
    blow: 0.2,
    momentum: 0.1,
    hitStop: 0.08,
  }),
  capitalArmour: death({
    pieces: [3, 5],
    primary: { kind: 'large', size: 1.6 },
    secondary: [blast('small', [1, 3], [0.5, 0.9], [0.2, 1.2], 'piece', 0.5, 0.2)],
    debris: { life: [3, 6], drift: [30, 90], spin: 2, fade: 0.5, trail: 1 },
    blow: 0.4,
    momentum: 0.1,
    hitStop: 0.04,
  }),
  capitalBridge: death({
    pieces: [5, 8],
    primary: { kind: 'heavy', size: 1.8 },
    secondary: [blast('small', [3, 5], [0.5, 1], [0.2, 2], 'piece', 0.6, 0.4)],
    debris: { life: [3, 6], drift: [20, 70], spin: 2, fade: 0.5, trail: 3 },
    blow: 0.3,
    momentum: 0.1,
    hitStop: 0.1,
  }),
  capitalCore: death({
    pieces: [8, 12],
    primary: { kind: 'heavy', size: 3 },
    secondary: [
      blast('large', [3, 5], [0.7, 1.1], [0.3, 3], 'piece', 0.6, 0.6),
      blast('heavy', [1, 2], [0.9, 1.3], [0.8, 3], 'wreck', 0, 0),
    ],
    debris: { life: [4, 7], drift: [40, 120], spin: 2, fade: 0.5, trail: 5 },
    blow: 0.1,
    momentum: 0,
    finalBlast: { kind: 'heavy', size: 4, delay: 3.5 },
    hitStop: 0.2,
  }),
};
