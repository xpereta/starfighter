import { ENEMY_GROUP_IDS, type EnemyGroupId, type EnemyKindTable } from './kinds';
import { checkInteger, checkOneOf } from './validate';

/** `count` enemies of one kind (or `count` wings, for `wing`) arriving together. */
export interface BattleGroup {
  kind: EnemyGroupId;
  count: number;
}

/** One wave of a battle: all its groups arrive at once; the next wave starts when none are left alive. */
export interface BattleWave {
  groups: BattleGroup[];
}

/** The authored plan of one battle (spec section 6). */
export interface BattleDef {
  waves: BattleWave[];
  /** Turret emplacements on the field (arena targets), as before. */
  turrets: number;
  /** A boss that must be destroyed to win; the battle is then won by its death, not by clearing the waves. */
  boss?: 'capital';
}

/** Index 0 is battle 1. The ramp is data: edit one file (`data/content/battles.ts`). */
export type BattleTable = readonly BattleDef[];

/**
 * Throws unless every battle has waves, every group a known kind and a sane count, and no group
 * asks for a kind before its `fromBattle`. `kinds` is optional so a table can be checked alone.
 */
export function validateBattleTable(table: BattleTable, kinds?: EnemyKindTable): void {
  if (table.length < 1) throw new Error('The battle table is empty');
  table.forEach((battle, b) => {
    const at = `battle ${b + 1}`;
    checkInteger(`${at}.turrets`, battle.turrets, 0, 20);
    if (battle.boss !== undefined) checkOneOf(`${at}.boss`, battle.boss, ['capital'] as const);
    if (battle.waves.length < 1) throw new Error(`${at} has no waves`);
    battle.waves.forEach((wave, w) => {
      const wat = `${at} wave ${w + 1}`;
      if (wave.groups.length < 1) throw new Error(`${wat} has no groups`);
      for (const g of wave.groups) {
        checkOneOf(`${wat}.kind`, g.kind, ENEMY_GROUP_IDS);
        checkInteger(`${wat}.count of ${g.kind}`, g.count, 1, 30);
        if (kinds && g.kind !== 'wing' && kinds[g.kind].fromBattle > b + 1) {
          throw new Error(
            `${wat} uses ${g.kind}, which only appears from battle ${kinds[g.kind].fromBattle}`,
          );
        }
      }
    });
  });
}
