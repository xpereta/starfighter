import { describe, expect, it } from 'vitest';
import { CALLSIGNS, FIRST_NAMES } from './names';
import { TRAIT_IDS, TRAITS, validateTraits, type TraitDef, type TraitId } from './traits';

describe('trait content', () => {
  it('has all five traits with a label and a blurb, and passes validation', () => {
    expect(TRAIT_IDS).toHaveLength(5);
    expect(() => validateTraits()).not.toThrow();
    for (const id of TRAIT_IDS) {
      expect(TRAITS[id].label.length).toBeGreaterThan(2);
      expect(TRAITS[id].blurb.length).toBeGreaterThan(10);
    }
  });

  it('rejects broken traits loudly', () => {
    const bad = (mutate: (t: TraitDef) => void): Record<TraitId, TraitDef> => {
      const copy = JSON.parse(JSON.stringify(TRAITS)) as Record<TraitId, TraitDef>;
      mutate(copy.bold);
      return copy;
    };
    expect(() => validateTraits(bad((t) => (t.multipliers.speed = 0)))).toThrow(/speed/);
    expect(() => validateTraits(bad((t) => (t.multipliers.gunDamage = NaN)))).toThrow(/gunDamage/);
    expect(() => validateTraits(bad((t) => (t.multipliers.guardBias = 2)))).toThrow(/guardBias/);
    expect(() => validateTraits(bad((t) => (t.label = '')))).toThrow(/label/);
  });
});

describe('name tables', () => {
  it('are non-empty with unique entries', () => {
    for (const table of [FIRST_NAMES, CALLSIGNS]) {
      expect(table.length).toBeGreaterThan(4);
      expect(new Set(table).size).toBe(table.length);
    }
  });
});
