import { validateEnemyKinds, type EnemyKindTable } from '../../src/core/enemies/kinds';
import { capitalKind } from './kinds/capital';
import { fighterKind } from './kinds/fighter';
import { gunshipKind } from './kinds/gunship';
import { lancerKind } from './kinds/lancer';

/**
 * Every enemy kind (spec section 1). One file per kind in `kinds/`, each owned by one track, so the
 * tracks never edit the same file; this index only lists them. Validated when first loaded:
 * bad data fails loudly. Only `fighter` is spawned today.
 */
export const ENEMY_KINDS: EnemyKindTable = {
  fighter: fighterKind,
  gunship: gunshipKind,
  lancer: lancerKind,
  capital: capitalKind,
};

validateEnemyKinds(ENEMY_KINDS);
