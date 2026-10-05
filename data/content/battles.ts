import {
  validateBattleTable,
  type BattleDef,
  type BattleTable,
} from '../../src/core/enemies/battles';
import { ENEMY_KINDS } from './enemies';

/** `waves` waves of `size` fighters each, `turrets` turret emplacements. */
const fighters = (waves: number, size: number, turrets: number): BattleDef => ({
  waves: Array.from({ length: waves }, () => ({ groups: [{ kind: 'fighter', count: size }] })),
  turrets,
});

/**
 * The authored ramp (spec section 6), one entry per battle, edit it here. For now it is exactly
 * today's behaviour (fighter waves and turrets from the run tuning's defaults: wavesBase 2 and
 * wavesPerBattle 0.7, waveSizeBase 3 and waveGrowth 1, turrets from battle 3), written out; a test
 * keeps it equal to those formulas. Nothing reads it yet: track A makes the run spawn from it,
 * then replaces rows with the spec's mix (wings, gunships, lancers) and track C adds the boss.
 */
export const BATTLES: BattleTable = [
  fighters(2, 3, 0), // battle 1
  fighters(3, 4, 0), // battle 2
  fighters(3, 5, 2), // battle 3
  fighters(4, 6, 3), // battle 4
];

validateBattleTable(BATTLES, ENEMY_KINDS);
