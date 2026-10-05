import { describe, expect, it } from 'vitest';
import { spectacle } from '../../data/styles/anime-spectacle/spectacle';
import { SPECTACLE_SLIDERS, sliderTarget } from './panel-spectacle-logic';

describe('Spectacle panel sliders', () => {
  it('every slider resolves to a number in the pack, inside its own range', () => {
    for (const s of SPECTACLE_SLIDERS) {
      const t = sliderTarget(spectacle, s);
      if (!t) continue; // a section the pack does not have
      const v = t[s.key] as number;
      expect(v, `${s.section}.${s.path}.${s.key}`).toBeGreaterThanOrEqual(s.def.min);
      expect(v, `${s.section}.${s.path}.${s.key}`).toBeLessThanOrEqual(s.def.max);
    }
  });

  it('a slider whose section is missing has no target', () => {
    expect(sliderTarget({}, SPECTACLE_SLIDERS[0]!)).toBeNull();
    expect(sliderTarget(spectacle, { ...SPECTACLE_SLIDERS[0]!, key: 'nope' })).toBeNull();
  });
});
