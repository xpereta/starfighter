import { TRAIT_IDS, type TraitId } from '../../../data/content/traits';

/**
 * Pilots (spec section 2). Issue A1 implements generation, the roster-as-wingmen link and trait
 * effects; this contract fixes the shape. Each active pilot is one wingman in run mode.
 */
export interface Pilot {
  /** Stable for the whole run (and saved with a veteran). */
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
}

export function createPilots(): Pilots {
  return { roster: [], nextId: 1 };
}

/** Feeds the roster into the replay hash. Add every field you add to `Pilot`/`Pilots`. */
export function mixPilots(mix: (n: number) => void, pilots: Pilots): void {
  mix(pilots.nextId);
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
