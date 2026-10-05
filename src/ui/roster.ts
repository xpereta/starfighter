import { TRAITS } from '../../data/content/traits';
import type { Pilot } from '../core/pilots/pilots';
import type { World } from '../core/world/world';

/** Used until the run module defines the waves of each battle (issue A2): the spec's `battleWaves`. */
const DEFAULT_BATTLE_WAVES: readonly number[] = [2, 3, 3, 4];

export interface Hull {
  hp: number;
  max: number;
}

/**
 * The hull of an active pilot. Integration point: until Track A links pilots to wingmen, the i-th
 * active pilot in the roster is the i-th wingman (each active pilot is one wingman in run mode).
 */
export function pilotHull(world: World, pilot: Pilot): Hull | null {
  if (pilot.status !== 'active') return null;
  const active = world.pilots.roster.filter((p) => p.status === 'active');
  const wingman = world.squadron.wingmen[active.indexOf(pilot)];
  if (!wingman) return null;
  const max = Math.max(world.tuning.squadron.health, wingman.hp);
  return { hp: wingman.alive ? Math.max(0, wingman.hp) : 0, max };
}

export interface RosterRow {
  name: string;
  trait: string;
  /** Hull pips drawn as text: `●` full, `○` empty. Empty string for a fallen pilot. */
  pips: string;
  fallen: boolean;
}

export function hullPips(hull: Hull | null): string {
  if (!hull) return '';
  const max = Math.max(1, Math.round(hull.max));
  const full = Math.max(0, Math.min(max, Math.round(hull.hp)));
  return '●'.repeat(full) + '○'.repeat(max - full);
}

/** One row per pilot of the run; fallen pilots stay in the list. */
export function rosterRows(world: World): RosterRow[] {
  return world.pilots.roster.map((p) => ({
    name: p.name,
    trait: TRAITS[p.trait].label,
    pips: hullPips(pilotHull(world, p)),
    fallen: p.status === 'lost',
  }));
}

/** Enemies still to destroy: living fighters, drones and turrets (static dummies do not count). */
export function hostileCount(world: World): number {
  let n = 0;
  for (const f of world.fighters) if (f.alive) n++;
  for (const t of world.targets) if (t.alive && t.kind !== 'static') n++;
  return n;
}

/** `BATTLE 2/4 · WAVE 2/3 · HOSTILES 5`, or null outside a battle of a run. */
export function objectiveText(world: World): string | null {
  const run = world.run;
  if (run.mode !== 'run' || run.phase !== 'battle') return null;
  const tuning = world.tuning as unknown as { run?: { battleCount?: number } };
  const battles = tuning.run?.battleCount ?? DEFAULT_BATTLE_WAVES.length;
  const waves = DEFAULT_BATTLE_WAVES[run.battle - 1] ?? DEFAULT_BATTLE_WAVES.at(-1) ?? 1;
  return `BATTLE ${run.battle}/${battles} · WAVE ${Math.max(1, run.wave)}/${waves} · HOSTILES ${hostileCount(world)}`;
}
