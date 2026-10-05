import type { EnemyKind } from '../../../src/core/enemies/kinds';
import { fighterKind } from './fighter';
import { lancerParams } from '../../tuning/lancer';

/** Missile fighter (spec section 4): a fighter variant that launches homing missiles (missile numbers: `data/tuning/lancer.ts`). A STUB, not spawned yet. Owned by track B. */
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
