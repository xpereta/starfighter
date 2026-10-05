import { TRAITS } from '../../data/content/traits';
import { maxHpOf } from '../core/pilots/effective';
import type { Pilot } from '../core/pilots/pilots';
import type { World } from '../core/world/world';

export interface Hull {
  hp: number;
  max: number;
}

/** The hull of an active pilot: its wingman's hit points against the pilot's maximum (the trait counts). */
export function pilotHull(world: World, pilot: Pilot): Hull | null {
  if (pilot.status !== 'active') return null;
  const wingman = world.squadron.wingmen.find((w) => w.pilotId === pilot.id);
  if (!wingman) return null;
  const max = Math.max(maxHpOf(world, pilot.id), wingman.hp);
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
  const battles = world.tuning.run.battleCount;
  const waves = Math.max(1, run.waveTotal);
  return `BATTLE ${run.battle}/${battles} · WAVE ${Math.max(1, run.wave)}/${waves} · HOSTILES ${hostileCount(world)}`;
}
