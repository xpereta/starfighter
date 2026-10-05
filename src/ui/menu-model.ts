import { TRAITS, type TraitId } from '../../data/content/traits';
import type { Pilot } from '../core/pilots/pilots';
import type { Run, RunPhase, RunResult } from '../core/run/run';
import type { World } from '../core/world/world';

/**
 * What the run menus show, as plain data (spec section 5). Pure: no DOM, no world mutation. The
 * screens are drawn by `menu-view.ts`; the game itself only ever changes through the `menu*`
 * actions, which the run consumes (the cursor index here is `world.run.cursor`).
 */

export type MenuKind = 'start' | 'debrief' | 'end';

export interface MenuItem {
  /** Stable id: `veteran:<id>`, `start`, `pick:<index>`, `skip`, `continue`, `restart`. */
  id: string;
  label: string;
  /** A second, dimmer line (for example what a trait does). */
  detail?: string;
  /** Tick box state for items that toggle (the veterans on the Start screen). */
  checked?: boolean;
}

export interface MenuScreen {
  kind: MenuKind;
  title: string;
  /** Short lines under the title (what happened, who is in the squad). */
  lines: string[];
  items: MenuItem[];
  /** The highlighted item, always inside `items`. */
  cursor: number;
}

/** A saved veteran as the Start screen lists it (what `run.available` holds). */
export interface VeteranOption {
  id: number;
  name: string;
  trait: TraitId;
  kills: number;
}

/** A generated pilot offered in the debrief pick. */
export interface Candidate {
  name: string;
  trait: TraitId;
}

/** Everything a screen needs. */
export interface MenuData {
  phase: RunPhase;
  /** The battle just finished (debrief) or the last one reached (end). */
  battle: number;
  /** How many battles a run has. */
  battles: number;
  result: RunResult;
  cursor: number;
  /** All the run's pilots, lost ones included. */
  roster: readonly Pilot[];
  veterans: readonly VeteranOption[];
  /** Ids of the veterans ticked to join the squad. */
  selectedVeterans: readonly number[];
  /** How many veterans may be brought. */
  maxVeterans: number;
  bestRun: number | null;
  /** The pilots offered after this battle (empty when none or the squad is full). */
  candidates: readonly Candidate[];
  squadFull: boolean;
}

/** True while a menu screen is up: only in run mode, outside the battle phase. */
export function menuVisible(run: Pick<Run, 'mode' | 'phase'>): boolean {
  return run.mode === 'run' && run.phase !== 'battle';
}

/** Builds the menu data from the world (the run, the roster, the tuning) and the saved best run. */
export function menuDataFromWorld(world: World, bestRun: number | null): MenuData {
  const { run, tuning } = world;
  const active = world.pilots.roster.filter((p) => p.status === 'active').length;
  return {
    phase: run.phase,
    battle: run.battle,
    battles: tuning.run.battleCount,
    result: run.result,
    cursor: run.cursor,
    roster: world.pilots.roster,
    veterans: run.available.map((v) => ({
      id: v.id,
      name: v.name,
      trait: v.trait,
      kills: v.kills ?? 0,
    })),
    selectedVeterans: run.selectedVeterans,
    maxVeterans: tuning.pilots.veteransPerRun,
    bestRun,
    // Only name and trait are shown.
    candidates: run.candidates.map((c) => ({ name: c.name, trait: c.trait })),
    squadFull: active >= tuning.pilots.squadMax,
  };
}

const traitLabel = (t: TraitId): string => TRAITS[t].label;
const pilotLine = (p: { name: string; trait: TraitId }): string =>
  `${p.name} (${traitLabel(p.trait)})`;

/** Keeps a cursor inside a list of `count` items. */
function clampCursor(cursor: number, count: number): number {
  return Math.max(0, Math.min(Math.max(0, count - 1), Math.round(cursor) || 0));
}

function bestRunLine(best: number | null): string {
  return best === null
    ? 'No finished run yet.'
    : `Best run: ${best} battle${best === 1 ? '' : 's'} cleared.`;
}

export function startScreen(d: MenuData): MenuScreen {
  const items: MenuItem[] = d.veterans.map((v) => ({
    id: `veteran:${v.id}`,
    label: pilotLine(v),
    detail: `${v.kills} kill${v.kills === 1 ? '' : 's'}`,
    checked: d.selectedVeterans.includes(v.id),
  }));
  items.push({ id: 'start', label: 'START RUN' });
  const lines = [`A short run: ${d.battles} battles. Pilots you lose are lost for good.`];
  if (d.veterans.length > 0) {
    lines.push(
      `Bring up to ${d.maxVeterans} veteran${d.maxVeterans === 1 ? '' : 's'} (${d.selectedVeterans.length} chosen):`,
    );
  } else {
    lines.push('No veterans yet: survive a run and your pilots will be here next time.');
  }
  lines.push(bestRunLine(d.bestRun));
  return {
    kind: 'start',
    title: 'STARFIGHTER',
    lines,
    items,
    cursor: clampCursor(d.cursor, items.length),
  };
}

export function debriefScreen(d: MenuData): MenuScreen {
  const active = d.roster.filter((p) => p.status === 'active');
  const lost = d.roster.filter((p) => p.status === 'lost');
  const lines = [
    active.length > 0
      ? `Squad: ${active.map(pilotLine).join(', ')}`
      : 'Squad: you are flying alone.',
  ];
  if (lost.length > 0) lines.push(`Lost: ${lost.map((p) => p.name).join(', ')}`);
  lines.push('Hull and squad repaired.');

  const items: MenuItem[] = [];
  if (!d.squadFull && d.candidates.length > 0) {
    lines.push('Choose a pilot to join you, or skip:');
    d.candidates.forEach((c, i) => {
      items.push({ id: `pick:${i}`, label: pilotLine(c), detail: TRAITS[c.trait].blurb });
    });
    items.push({ id: 'skip', label: 'SKIP, no new pilot' });
  } else {
    if (d.squadFull) lines.push('The squad is full.');
    items.push({ id: 'continue', label: 'CONTINUE' });
  }
  return {
    kind: 'debrief',
    title: `BATTLE ${d.battle} OF ${d.battles} CLEARED`,
    lines,
    items,
    cursor: clampCursor(d.cursor, items.length),
  };
}

export function endScreen(d: MenuData): MenuScreen {
  const won = d.result === 'victory';
  const survivors = d.roster.filter((p) => p.status === 'active');
  const fallen = d.roster.filter((p) => p.status === 'lost');
  const cleared = won ? d.battles : Math.max(0, d.battle - 1);
  const lines = [`Battles cleared: ${cleared} of ${d.battles}.`];
  lines.push(
    survivors.length > 0
      ? `Survived: ${survivors.map(pilotLine).join(', ')}`
      : 'No pilot survived.',
  );
  if (fallen.length > 0) lines.push(`Lost: ${fallen.map((p) => p.name).join(', ')}`);
  if (survivors.length > 0) lines.push('Survivors are saved as veterans for your next run.');
  const items: MenuItem[] = [{ id: 'restart', label: 'RESTART' }];
  return {
    kind: 'end',
    title: won ? 'VICTORY' : 'DEFEAT',
    lines,
    items,
    cursor: clampCursor(d.cursor, items.length),
  };
}

/** The screen for the current phase, or null while a battle is on. */
export function buildScreen(d: MenuData): MenuScreen | null {
  if (d.phase === 'start') return startScreen(d);
  if (d.phase === 'debrief') return debriefScreen(d);
  if (d.phase === 'end') return endScreen(d);
  return null;
}
