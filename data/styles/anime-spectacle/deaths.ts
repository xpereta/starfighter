import {
  MAX_DEATH_SECONDS,
  MAX_PIECES,
  MAX_SECONDARY_BLASTS,
  type DeathDef,
  type DeathDefs,
  type Range,
  type SecondaryDef,
} from '../../../src/render/style';
import { deaths as animeDeaths } from '../anime-80s/deaths';

/**
 * The spectacle deaths: the parent's sequences made longer and wilder (Xavi: enemy explosions must
 * take longer, and the fragments should fly out in more directions at random). Delays and the
 * lingering of debris are stretched, there are more secondary blasts, pieces keep little of the
 * killing blow's direction and are scattered over every direction at very different speeds.
 */
/**
 * Prototype 5 ships in the anime idiom (the parent has none of them), before the pack's `wilder`
 * pass: sizes in ship radii, as the parent's. A gunship comes apart in plates with a long chain and
 * a last burst; a missile fighter cooks off its warheads; a capital ship's parts blow one by one
 * (the death chain times them) and its hull breaks into big pieces with a huge last blast.
 */
const secondary = (
  kind: 'small' | 'large' | 'heavy' | 'missile',
  count: [number, number],
  size: [number, number],
  delay: [number, number],
  attach: 'piece' | 'wreck',
  consume: number,
  chain: number,
) => ({ kind, count, size, delay, attach, consume, chain });

const p5: DeathDefs = {
  gunship: {
    pieces: [8, 12],
    primary: { kind: 'large', size: 2.6 },
    secondary: [
      secondary('small', [3, 5], [0.5, 0.9], [0.2, 1.4], 'piece', 0.6, 0.35),
      secondary('large', [1, 2], [0.7, 1.1], [0.5, 1.6], 'wreck', 0, 0),
    ],
    debris: { life: [2.5, 4.5], drift: [50, 150], spin: 3, fade: 0.5, trail: 4 },
    blow: 0.4,
    momentum: 0.4,
    finalBlast: { kind: 'large', size: 1.6, delay: 1.8 },
    hitStop: 0.08,
  },
  lancer: {
    pieces: [5, 8],
    primary: { kind: 'large', size: 2.2 },
    secondary: [
      secondary('small', [2, 4], [0.5, 0.9], [0.15, 1.0], 'piece', 0.6, 0.3),
      secondary('missile', [1, 3], [0.5, 0.9], [0.1, 0.7], 'piece', 0.5, 0.4),
    ],
    debris: { life: [1.8, 3.2], drift: [80, 200], spin: 7, fade: 0.5, trail: 3 },
    blow: 0.5,
    momentum: 0.6,
    hitStop: 0.05,
  },
  capital: {
    pieces: [14, 20],
    primary: { kind: 'heavy', size: 1.3 },
    secondary: [
      secondary('large', [4, 6], [0.15, 0.35], [0.2, 3], 'piece', 0.7, 0.5),
      secondary('heavy', [2, 3], [0.2, 0.4], [0.5, 3.5], 'wreck', 0, 0),
      secondary('small', [4, 6], [0.1, 0.2], [0.1, 2.5], 'piece', 0.5, 0.4),
    ],
    debris: { life: [3, 6], drift: [40, 140], spin: 1.2, fade: 0.5, trail: 4 },
    blow: 0.3,
    momentum: 0.2,
    finalBlast: { kind: 'heavy', size: 2, delay: 3.5 },
    hitStop: 0.12,
  },
  capitalTurret: {
    pieces: [3, 5],
    primary: { kind: 'large', size: 1.7 },
    secondary: [secondary('small', [1, 3], [0.4, 0.8], [0.1, 0.8], 'piece', 0.6, 0.2)],
    debris: { life: [1.5, 3], drift: [40, 120], spin: 5, fade: 0.5, trail: 2 },
    blow: 0.5,
    momentum: 0.3,
    hitStop: 0,
  },
  capitalEngine: {
    pieces: [3, 6],
    primary: { kind: 'heavy', size: 1.7 },
    secondary: [secondary('small', [3, 5], [0.4, 0.8], [0.2, 1.6], 'wreck', 0, 0)],
    debris: { life: [2, 3.5], drift: [30, 90], spin: 3, fade: 0.5, trail: 5 },
    blow: 0.4,
    momentum: 0.3,
    hitStop: 0,
  },
  capitalArmour: {
    pieces: [3, 5],
    primary: { kind: 'large', size: 1.4 },
    secondary: [],
    debris: { life: [1.5, 3], drift: [30, 90], spin: 3, fade: 0.5, trail: 0 },
    blow: 0.5,
    momentum: 0.3,
    hitStop: 0,
  },
  capitalBridge: {
    pieces: [4, 6],
    primary: { kind: 'large', size: 2.1 },
    secondary: [secondary('large', [1, 2], [0.5, 0.9], [0.2, 1], 'piece', 0.5, 0.3)],
    debris: { life: [2, 3.5], drift: [50, 130], spin: 4, fade: 0.5, trail: 2 },
    blow: 0.5,
    momentum: 0.3,
    hitStop: 0.05,
  },
  capitalCore: {
    pieces: [6, 10],
    primary: { kind: 'heavy', size: 2.3 },
    secondary: [secondary('large', [2, 4], [0.5, 1], [0.1, 0.9], 'piece', 0.6, 0.4)],
    debris: { life: [2, 4], drift: [60, 160], spin: 4, fade: 0.5, trail: 3 },
    blow: 0.4,
    momentum: 0.3,
    finalBlast: { kind: 'heavy', size: 2.6, delay: 0.4 },
    hitStop: 0.1,
  },
};

const parent: DeathDefs = { ...animeDeaths, ...p5 };

const TIME = 2.2; // how much longer the secondary blasts take to run their course
const LINGER = 1.7; // how much longer the debris stays
const SPEED = 1.5; // how much faster (and wider) the pieces fly

const capTime = (v: number): number => Math.min(MAX_DEATH_SECONDS, v);
const scale = (r: Range, k: number): Range => [capTime(r[0] * k), capTime(r[1] * k)];
const wide = (r: Range, k: number): Range => [r[0] * k * 0.4, r[1] * k * 1.6];

/** Trims the biggest groups until the whole sequence fits the hard limit on secondary blasts. */
function fit(groups: SecondaryDef[]): SecondaryDef[] {
  const total = (): number => groups.reduce((n, g) => n + g.count[1], 0);
  while (total() > MAX_SECONDARY_BLASTS) {
    let big = 0;
    groups.forEach((g, i) => {
      if (g.count[1] > groups[big]!.count[1]) big = i;
    });
    const g = groups[big]!;
    groups[big] = { ...g, count: [Math.min(g.count[0], g.count[1] - 1), g.count[1] - 1] };
  }
  return groups;
}

function wilder(def: DeathDef): DeathDef {
  return {
    ...def,
    pieces: [Math.min(MAX_PIECES, def.pieces[0] + 2), Math.min(MAX_PIECES, def.pieces[1] + 3)],
    secondary: fit(
      def.secondary.map((s) => ({
        ...s,
        count: [
          Math.min(MAX_SECONDARY_BLASTS, s.count[0] + 1),
          Math.min(MAX_SECONDARY_BLASTS, s.count[1] + 2),
        ] as [number, number],
        delay: scale(s.delay, TIME),
      })),
    ),
    debris: {
      ...def.debris,
      life: scale(def.debris.life, LINGER),
      drift: wide(def.debris.drift, SPEED),
      spin: def.debris.spin * 1.4,
      scatter: 1,
    },
    blow: def.blow * 0.25,
    finalBlast: def.finalBlast ?? undefined,
  };
}

export const deaths: DeathDefs = Object.fromEntries(
  Object.entries(parent).map(([kind, def]) => [kind, wilder(def)]),
) as DeathDefs;
