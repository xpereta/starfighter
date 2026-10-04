import type { TraitId } from '../../../data/content/traits';

/**
 * Persistent player data (spec section 6): the veterans roster and the best run. Issue A3 adds the
 * pure functions (promotion at the end of a run, deletion on loss, selection, v1 to v2 migration) and
 * switches `src/app/save.ts` to save version 2; this contract fixes the types.
 */
export interface Veteran {
  id: number;
  name: string;
  trait: TraitId;
  kills: number;
  /** Runs survived. */
  runs: number;
}

export interface MetaData {
  veterans: Veteran[];
  /** Best finished run (battles cleared, then time), or null. */
  bestRun: number | null;
}

export function createMeta(): MetaData {
  return { veterans: [], bestRun: null };
}
