/**
 * Pilot traits (spec: docs/specs/prototype-3-pilots.md section 2). Each trait is a set of multipliers
 * on one wingman's existing squadron parameters, so a trait changes how they fly and fight. The
 * contract (this file's shape and `validateTraits`) lands first; issue A1 fills in the real numbers.
 * Neutral values: multipliers 1, additive hp 0.
 */

export const TRAIT_IDS = ['sharpshooter', 'steady', 'bold', 'guardian', 'hunter'] as const;
export type TraitId = (typeof TRAIT_IDS)[number];

export interface TraitMultipliers {
  /** x the wingman's fire cone (wider = easier to hit with). */
  fireCone: number;
  /** x the damage of its guns. */
  gunDamage: number;
  /** Added to its hit points (can be negative). */
  healthBonus: number;
  /** x the slot hold radius (smaller = stays tighter in formation). */
  slotHold: number;
  /** x the distance at which it engages enemies. */
  engageRange: number;
  /** x its top speed. */
  speed: number;
  /** x the damage of the missile it fires in a salvo. */
  missileDamage: number;
  /** 0..1: how strongly it prefers enemies that are chasing the player. */
  guardBias: number;
}

export interface TraitDef {
  /** Short name shown in menus and on the HUD. */
  label: string;
  /** One line saying what the trait does, for the pilot pick. */
  blurb: string;
  multipliers: TraitMultipliers;
}

const neutral = (): TraitMultipliers => ({
  fireCone: 1,
  gunDamage: 1,
  healthBonus: 0,
  slotHold: 1,
  engageRange: 1,
  speed: 1,
  missileDamage: 1,
  guardBias: 0,
});

/** Placeholder numbers until issue A1; every trait is neutral so nothing changes yet. */
export const TRAITS: Record<TraitId, TraitDef> = {
  sharpshooter: {
    label: 'Sharpshooter',
    blurb: 'Hits what it aims at, harder.',
    multipliers: neutral(),
  },
  steady: { label: 'Steady', blurb: 'Tough, and stays in formation.', multipliers: neutral() },
  bold: { label: 'Bold', blurb: 'Fast and aggressive, but fragile.', multipliers: neutral() },
  guardian: { label: 'Guardian', blurb: 'Goes after whatever chases you.', multipliers: neutral() },
  hunter: { label: 'Hunter', blurb: 'Its missiles hit much harder.', multipliers: neutral() },
};

/** Throws on a trait that would break the game (non-finite or non-positive multipliers). Run at load. */
export function validateTraits(traits: Record<TraitId, TraitDef> = TRAITS): void {
  for (const id of TRAIT_IDS) {
    const def = traits[id];
    if (!def) throw new Error(`Missing trait "${id}"`);
    if (!def.label || !def.blurb) throw new Error(`Trait "${id}" needs a label and a blurb`);
    const m = def.multipliers;
    for (const key of [
      'fireCone',
      'gunDamage',
      'slotHold',
      'engageRange',
      'speed',
      'missileDamage',
    ] as const) {
      if (!Number.isFinite(m[key]) || m[key] <= 0)
        throw new Error(`Trait "${id}".${key} must be a positive number`);
    }
    if (!Number.isFinite(m.healthBonus))
      throw new Error(`Trait "${id}".healthBonus must be a number`);
    if (!Number.isFinite(m.guardBias) || m.guardBias < 0 || m.guardBias > 1) {
      throw new Error(`Trait "${id}".guardBias must be between 0 and 1`);
    }
  }
}

validateTraits();
