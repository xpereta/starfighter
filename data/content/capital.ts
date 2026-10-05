import type { CapitalPartDef } from '../../src/core/enemies/capital-parts';

/**
 * The capital ship's parts (spec section 5): turret mounts, 2 engines, armour plates covering the
 * core, a bridge and the core. EMPTY until track C fills it in; it is not validated at load while
 * empty (an empty list is not a legal ship), track C adds a test that runs `validateCapitalParts`
 * with the hull radius from `data/tuning/capital.ts` over this list. Owned by track C.
 */
export const CAPITAL_PARTS: readonly CapitalPartDef[] = [];
