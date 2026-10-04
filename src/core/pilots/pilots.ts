import { CALLSIGNS, FIRST_NAMES } from '../../../data/content/names';
import { TRAIT_IDS, type TraitId } from '../../../data/content/traits';
import { createRng } from '../rng/rng';
import { getLockable } from '../world/lockable';
import type { World } from '../world/world';

/**
 * Pilots (spec section 2). A pilot is generated (a name and one trait), joins the run's roster and
 * flies as one wingman; a pilot shot down in run mode is lost for good (the entry stays, struck
 * through on the HUD). Everything here is deterministic: names and traits come from the world seed
 * and a draw counter, never from the simulation's random stream.
 */
export interface Pilot {
  /** Stable for the whole run (and saved with a veteran). Ids start at 1: 0 means "the player" or "nobody". */
  id: number;
  name: string;
  trait: TraitId;
  kills: number;
  /** Battles flown. */
  battles: number;
  /** `lost` pilots stay in the list (struck through on the HUD). */
  status: 'active' | 'lost';
  veteran: boolean;
}

export interface Pilots {
  roster: Pilot[];
  /** The id the next pilot gets. */
  nextId: number;
  /** How many random draws name and trait generation has used (a pilot is a pure function of seed + draw). */
  draws: number;
}

/** What a generated or saved pilot looks like before it joins the roster. */
export interface PilotTemplate {
  name: string;
  trait: TraitId;
  kills?: number;
  veteran?: boolean;
}

export function createPilots(): Pilots {
  return { roster: [], nextId: 1, draws: 0 };
}

/** Feeds the roster into the replay hash. Add every field you add to `Pilot`/`Pilots`. */
export function mixPilots(mix: (n: number) => void, pilots: Pilots): void {
  mix(pilots.nextId);
  mix(pilots.draws);
  mix(pilots.roster.length);
  for (const p of pilots.roster) {
    mix(p.id);
    for (let i = 0; i < p.name.length; i++) mix(p.name.charCodeAt(i));
    mix(TRAIT_IDS.indexOf(p.trait));
    mix(p.kills);
    mix(p.battles);
    mix(p.status === 'active' ? 1 : 0);
    mix(p.veteran ? 1 : 0);
  }
}

export function findPilot(pilots: Pilots, id: number): Pilot | undefined {
  for (const p of pilots.roster) if (p.id === id) return p;
  return undefined;
}

export function activePilots(pilots: Pilots): Pilot[] {
  return pilots.roster.filter((p) => p.status === 'active');
}

export function activeCount(pilots: Pilots): number {
  let n = 0;
  for (const p of pilots.roster) if (p.status === 'active') n++;
  return n;
}

/** A number in [0, 1) that depends only on the world seed and the draw number. */
function unit(seed: number, draw: number): number {
  return createRng((seed ^ Math.imul(draw + 1, 0x9e3779b1)) >>> 0).next();
}

/**
 * Generates `count` distinct pilots (not yet in the roster). First names and callsigns are never
 * reused inside the run (the roster, lost pilots included, and the batch itself), and the batch has
 * different traits whenever there are enough traits, so a pick is a real choice.
 */
export function generatePilots(world: World, count: number): PilotTemplate[] {
  const pilots = world.pilots;
  const usedFirst = new Set<string>();
  const usedCallsign = new Set<string>();
  for (const p of pilots.roster) {
    const [first, callsign] = p.name.split(' ');
    if (first) usedFirst.add(first);
    if (callsign) usedCallsign.add(callsign);
  }
  const usedTraits = new Set<TraitId>();
  const batch: PilotTemplate[] = [];
  const attempts = 200; // far more than ever needed; only a bound so exhausted tables cannot loop forever
  for (let k = 0; k < count; k++) {
    let chosen: PilotTemplate | null = null;
    for (let a = 0; a < attempts && !chosen; a++) {
      const first = FIRST_NAMES[Math.floor(unit(world.seed, pilots.draws++) * FIRST_NAMES.length)]!;
      const callsign = CALLSIGNS[Math.floor(unit(world.seed, pilots.draws++) * CALLSIGNS.length)]!;
      const trait = TRAIT_IDS[Math.floor(unit(world.seed, pilots.draws++) * TRAIT_IDS.length)]!;
      const traitsLeft = usedTraits.size < TRAIT_IDS.length;
      const lastAttempt = a === attempts - 1;
      if (!lastAttempt && (usedFirst.has(first) || usedCallsign.has(callsign))) continue;
      if (!lastAttempt && traitsLeft && usedTraits.has(trait)) continue;
      chosen = { name: `${first} ${callsign}`, trait };
    }
    const pick = chosen!;
    const [first, callsign] = pick.name.split(' ');
    usedFirst.add(first!);
    usedCallsign.add(callsign!);
    usedTraits.add(pick.trait);
    batch.push(pick);
  }
  return batch;
}

/** The candidates for a post-battle pick: `pickCount` distinct pilots. */
export function generateCandidates(world: World): PilotTemplate[] {
  return generatePilots(world, world.tuning.pilots.pickCount);
}

/**
 * Adds a pilot to the squad if there is a free slot (`squadMax`); returns it, or null when the squad
 * is full. The pilot becomes a wingman on the next squadron step.
 */
export function addPilot(
  world: World,
  template: PilotTemplate,
  how: 'rescue' | 'pick' | 'veteran',
): Pilot | null {
  const pilots = world.pilots;
  if (activeCount(pilots) >= world.tuning.pilots.squadMax) return null;
  const pilot: Pilot = {
    id: pilots.nextId++,
    name: template.name,
    trait: template.trait,
    kills: template.kills ?? 0,
    battles: 0,
    status: 'active',
    veteran: template.veteran ?? how === 'veteran',
  };
  pilots.roster.push(pilot);
  world.events.emit({ type: 'PilotJoined', pilotId: pilot.id, how });
  return pilot;
}

/** Marks a pilot lost for good and says so. Does nothing for an unknown or already lost pilot. */
export function losePilot(world: World, pilotId: number): void {
  const pilot = findPilot(world.pilots, pilotId);
  if (!pilot || pilot.status === 'lost') return;
  pilot.status = 'lost';
  world.events.emit({ type: 'PilotLost', pilotId });
}

/** Every active pilot has flown one more battle (called when a battle is cleared). */
export function markBattleFlown(world: World): void {
  for (const p of world.pilots.roster) if (p.status === 'active') p.battles++;
}

/**
 * Credits kills: for every `Killed` event of an enemy this step, the pilot who last damaged it (see
 * `lastHitBy` on bodies) gets a kill and a `PilotKill`. The player's own kills credit nobody.
 */
export function stepPilots(world: World): void {
  for (const e of world.events.events) {
    if (e.type !== 'Killed' || e.kind === 'wingman') continue;
    const body = getLockable(world, e.entityId);
    const owner = body?.lastHitBy ?? 0;
    if (owner <= 0) continue;
    const pilot = findPilot(world.pilots, owner);
    if (!pilot) continue;
    pilot.kills++;
    world.events.emit({ type: 'PilotKill', pilotId: pilot.id });
  }
}
