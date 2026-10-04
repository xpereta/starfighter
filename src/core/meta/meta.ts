import { TRAIT_IDS, type TraitId } from '../../../data/content/traits';
import type { Pilot } from '../pilots/pilots';
import type { OfferedVeteran, Run } from '../run/run';

/**
 * Persistent player data (spec section 6): the veterans roster and the best run. Pure functions only:
 * the app loads this at boot, hands the veterans to the Start screen (`veteranOffers` then
 * `offerVeterans`), and at the end of a run saves what `applyRunEnd` returns. It is never simulation
 * state and never in the replay hash.
 */
export interface Veteran {
  /** Stable for the life of the save; never reused while the veteran is alive. */
  id: number;
  name: string;
  trait: TraitId;
  kills: number;
  /** Runs survived. */
  runs: number;
}

export interface MetaData {
  veterans: Veteran[];
  /** Best run so far: the most battles cleared in one run (a victory is `battleCount`), or null before the first. */
  bestRun: number | null;
}

export function createMeta(): MetaData {
  return { veterans: [], bestRun: null };
}

/** The largest roster `parseMeta` accepts, whatever `veteranCap` was when the save was written. */
const HARD_CAP = 64;

/** Reads meta from untrusted JSON: invalid veterans are dropped, ids made unique, the roster capped. */
export function parseMeta(raw: unknown): MetaData {
  const meta = createMeta();
  if (typeof raw !== 'object' || raw === null) return meta;
  const obj = raw as Record<string, unknown>;
  const best = obj.bestRun;
  if (typeof best === 'number' && Number.isInteger(best) && best >= 0) meta.bestRun = best;
  if (!Array.isArray(obj.veterans)) return meta;
  const seen = new Set<number>();
  for (const item of obj.veterans as unknown[]) {
    if (typeof item !== 'object' || item === null) continue;
    const v = item as Record<string, unknown>;
    if (typeof v.id !== 'number' || !Number.isInteger(v.id) || v.id < 1 || seen.has(v.id)) continue;
    if (typeof v.name !== 'string' || v.name.length === 0 || v.name.length > 40) continue;
    if (!TRAIT_IDS.includes(v.trait as TraitId)) continue;
    seen.add(v.id);
    meta.veterans.push({
      id: v.id,
      name: v.name,
      trait: v.trait as TraitId,
      kills: count(v.kills),
      runs: count(v.runs),
    });
    if (meta.veterans.length >= HARD_CAP) break;
  }
  return meta;
}

function count(n: unknown): number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 ? n : 0;
}

/** Battles cleared in a finished run: all of them on a victory, otherwise the ones before the one that was lost. */
export function battlesCleared(run: Pick<Run, 'battle' | 'result'>): number {
  return run.result === 'victory' ? run.battle : Math.max(0, run.battle - 1);
}

/** Best first: most kills, then most runs, then the older id (so the order never depends on input order). */
function rank(a: Veteran, b: Veteran): number {
  return b.kills - a.kills || b.runs - a.runs || a.id - b.id;
}

/**
 * The roster after a run (spec section 6): every pilot still active is a veteran (a saved veteran
 * stays one with `runs` + 1 and its kills updated; anyone else becomes a new veteran), a saved
 * veteran who was lost is deleted, and veterans who did not fly are untouched. Past `cap` the veterans
 * with the fewest kills are dropped. `bestRun` improves if this run cleared more battles. Pure: returns
 * a new object.
 */
export function applyRunEnd(
  meta: MetaData,
  roster: readonly Pilot[],
  cleared: number,
  cap: number,
): MetaData {
  const veterans = new Map<number, Veteran>(meta.veterans.map((v) => [v.id, { ...v }]));
  let nextId = Math.max(0, ...veterans.keys()) + 1;
  for (const pilot of roster) {
    const saved = pilot.veteranId ? veterans.get(pilot.veteranId) : undefined;
    if (pilot.status === 'lost') {
      if (saved) veterans.delete(saved.id);
      continue;
    }
    if (saved) {
      saved.kills = pilot.kills;
      saved.runs += 1;
    } else {
      const id = nextId++;
      veterans.set(id, { id, name: pilot.name, trait: pilot.trait, kills: pilot.kills, runs: 1 });
    }
  }
  const kept = [...veterans.values()].sort(rank).slice(0, Math.max(0, cap));
  kept.sort((a, b) => a.id - b.id); // the save lists veterans in the order they were found
  const bestRun = meta.bestRun === null ? cleared : Math.max(meta.bestRun, cleared);
  return { veterans: kept, bestRun };
}

/** The result of a finished run in one call: what the app saves when the phase becomes `end`. */
export function applyFinishedRun(
  meta: MetaData,
  roster: readonly Pilot[],
  run: Pick<Run, 'battle' | 'result'>,
  cap: number,
): MetaData {
  return applyRunEnd(meta, roster, battlesCleared(run), cap);
}

/** The veterans as the Start screen offers them (`offerVeterans(world, veteranOffers(meta))`). */
export function veteranOffers(meta: MetaData): OfferedVeteran[] {
  return meta.veterans.map((v) => ({
    id: v.id,
    name: v.name,
    trait: v.trait,
    kills: v.kills,
    veteran: true,
  }));
}
