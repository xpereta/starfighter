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
const wing = (count = 1): BattleGroup => ({ kind: 'wing', count });
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
 * - Battle 3: wings, two gunships, the first missile fighter on its own, then pairs (the lancer
 *   kind is track B's: until it lands a lancer group is simply skipped by the wave spawner).
 * - Battle 4: still the old row. Track C replaces it with the boss script (`boss: 'capital'`,
 *   two escort wings, missile fighters joining halfway); the run's win condition for a boss
 *   battle is the hook in `stepRunBattle` (`run.ts`).
 */
export const BATTLES: BattleTable = [
  {
    waves: [wave(fighter(3)), wave(fighter(3), wing())],
    turrets: 0,
  }, // battle 1
  {
    waves: [wave(fighter(4)), wave(fighter(2), gunship()), wave(fighter(2), wing())],
    turrets: 0,
  }, // battle 2
  {
    waves: [
      wave(fighter(2), wing()),
      wave(fighter(3), gunship(), lancer()),
      wave(wing(), gunship(), lancer(2)),
    ],
    turrets: 2,
  }, // battle 3
  fighters(4, 6, 3), // battle 4 (track C: the capital ship boss)
];

validateBattleTable(BATTLES, ENEMY_KINDS);
