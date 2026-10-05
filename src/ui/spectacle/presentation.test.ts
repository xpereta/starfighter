import { describe, expect, it } from 'vitest';
import { presentation } from '../../../data/styles/anime-spectacle/presentation';
import { styles } from '../../../data/styles';
import { presentations } from './active';
import { validatePresentation } from './presentation';

describe('presentation', () => {
  it('the anime-spectacle presentation validates', () => {
    expect(validatePresentation(presentation)).toEqual([]);
  });

  it('every style with a presentation is a registered pack', () => {
    for (const id of Object.keys(presentations)) expect(styles[id]).toBeDefined();
  });

  it('rejects out-of-range values', () => {
    const bad = structuredClone(presentation);
    bad.feel.maxFreeze = 9;
    bad.combo.tiers = [
      { at: 5, label: 'A' },
      { at: 3, label: 'B' },
    ];
    const errors = validatePresentation(bad);
    expect(errors.some((e) => e.includes('maxFreeze'))).toBe(true);
    expect(errors.some((e) => e.includes('increasing'))).toBe(true);
  });
});
