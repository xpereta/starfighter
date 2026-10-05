import type { EnemyKind } from '../../../src/core/enemies/kinds';
import { capitalParams } from '../../tuning/capital';

/**
 * Capital ship (spec section 5), the boss of battle 4. A STUB, not spawned yet. Its guns and hit
 * points live in its parts (`data/content/capital.ts`), so `mounts` is empty and `hull` is only a
 * placeholder the validator needs. Owned by track C.
 */
export const capitalKind: EnemyKind = {
  id: 'capital',
  label: 'Capital ship',
  hull: 1,
  radius: capitalParams.hullRadius.default,
  speedScale: 0.1,
  turnScale: 0.05,
  mounts: [],
  ai: 'capital',
  threat: 20,
  fromBattle: 4,
};
