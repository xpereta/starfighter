import type { EnemyKind } from '../../../src/core/enemies/kinds';
import { fighterKind } from './fighter';
import { lancerParams } from '../../tuning/lancer';

/** Missile fighter (spec section 4): a fighter variant that launches homing missiles (missile numbers: `data/tuning/lancer.ts`). Owned by track B. */
export const lancerKind: EnemyKind = {
  id: 'lancer',
  label: 'Missile fighter',
  hull: 3,
  radius: fighterKind.radius,
  speedScale: lancerParams.speedScale.default,
  turnScale: fighterKind.turnScale,
  mounts: [],
  ai: 'lancer',
  threat: 2,
  fromBattle: 3,
};

/**
 * Where lancers join the run (spec section 6), edit it here: `LANCER_RAMP[battle - 1][wave - 1]` is
 * how many fighters of that wave are lancers instead (the wave size stays the same; a battle's last
 * entry repeats for longer battles, missing battles have none). Battle 3: the first lancer alone,
 * then pairs; battle 4: lancers join halfway. A local hook behind `tuning.lancer.inBattles` until the
 * authored battle table (track A) spawns kinds; then these rows move into `battles.ts`.
 */
export const LANCER_RAMP: readonly (readonly number[])[] = [
  [], // battle 1
  [], // battle 2
  [1, 2, 2], // battle 3
  [0, 0, 2, 2], // battle 4
];
