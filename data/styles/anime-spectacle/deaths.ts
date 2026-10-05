import {
  MAX_DEATH_SECONDS,
  MAX_PIECES,
  MAX_SECONDARY_BLASTS,
  type DeathDef,
  type DeathDefs,
  type Range,
} from '../../../src/render/style';
import { deaths as parent } from '../anime-80s/deaths';

/**
 * The spectacle deaths: the parent's sequences made longer and wilder (Xavi: enemy explosions must
 * take longer, and the fragments should fly out in more directions at random). Delays and the
 * lingering of debris are stretched, there are more secondary blasts, pieces keep little of the
 * killing blow's direction and are scattered over every direction at very different speeds.
 */
const TIME = 2.2; // how much longer the secondary blasts take to run their course
const LINGER = 1.7; // how much longer the debris stays
const SPEED = 1.5; // how much faster (and wider) the pieces fly

const capTime = (v: number): number => Math.min(MAX_DEATH_SECONDS, v);
const scale = (r: Range, k: number): Range => [capTime(r[0] * k), capTime(r[1] * k)];
const wide = (r: Range, k: number): Range => [r[0] * k * 0.4, r[1] * k * 1.6];

function wilder(def: DeathDef): DeathDef {
  return {
    ...def,
    pieces: [Math.min(MAX_PIECES, def.pieces[0] + 2), Math.min(MAX_PIECES, def.pieces[1] + 3)],
    secondary: def.secondary.map((s) => ({
      ...s,
      count: [
        Math.min(MAX_SECONDARY_BLASTS, s.count[0] + 1),
        Math.min(MAX_SECONDARY_BLASTS, s.count[1] + 2),
      ],
      delay: scale(s.delay, TIME),
    })),
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
