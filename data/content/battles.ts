import {
  validateBattleTable,
  type BattleDef,
  type BattleGroup,
  type BattleTable,
} from '../../src/core/enemies/battles';
import { ENEMY_KINDS } from './enemies';

/** `waves` waves of `size` fighters each, `turrets` turret emplacements (the classic ramp's shape). */
const fighters = (waves: number, size: number, turrets: number): BattleDef => ({
  waves: Array.from({ length: waves }, () => ({ groups: [{ kind: 'fighter', count: size }] })),
  turrets,
});

/** One wave: its groups all arrive at once; the next wave comes when none are left. */
const wave = (...groups: BattleGroup[]) => ({ groups });
const fighter = (count: number): BattleGroup => ({ kind: 'fighter', count });
const wing = (count = 1, size?: number): BattleGroup =>
  size === undefined ? { kind: 'wing', count } : { kind: 'wing', count, size };
const gunship = (count = 1): BattleGroup => ({ kind: 'gunship', count });
const lancer = (count = 1): BattleGroup => ({ kind: 'lancer', count });

/**
 * The authored ramp (spec section 6), one entry per battle: edit it here. A `wing` group counts
 * wings (`wings.size` fighters each, from `data/tuning/wings.ts`). The old fighter-only ramp is
 * still there as the tuning toggle `run.ramp = classic` (what the run formulas in `data/tuning/run.ts`
 * give), which the older tests use.
 *
 * - Battle 1: fighters, and one formation wing in the last wave (the introduction).
 * - Battle 2: fighters and wings, one gunship in wave 2.
 * - Battle 3: wings, two gunships, the first missile fighter on its own (wave 2), then a pair (wave 3).
 * - Battle 4: the capital ship (`boss: 'capital'`): its escort wings and the missile fighters that
 *   join halfway come from the boss script (`core/enemies/capital-battle.ts`), not from these waves.
 */
export const BATTLES: BattleTable = [
  {
    waves: [wave(fighter(2)), wave(wing(1, 3))],
    turrets: 0,
  }, // battle 1
  {
    waves: [wave(fighter(2)), wave(fighter(1), gunship()), wave(fighter(1), wing(1, 3))],
    turrets: 0,
  }, // battle 2
  {
    waves: [wave(wing(1, 3)), wave(gunship(), lancer()), wave(gunship(), lancer(2))],
    turrets: 2,
  }, // battle 3
  // Battle 4: the capital ship (boss, track C). Its escorts come from the boss script (`capital-battle.ts`: two
  // wings, then missile fighters halfway through the approach), so the waves here are only the objective
  // placeholder the table type needs: the battle is won by the core's death.
  { ...fighters(1, 1, 3), boss: 'capital' },
];

validateBattleTable(BATTLES, ENEMY_KINDS);
