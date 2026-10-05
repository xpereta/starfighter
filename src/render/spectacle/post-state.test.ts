import { describe, expect, it } from 'vitest';
import { spectacle } from '../../../data/styles/anime-spectacle/spectacle';
import { chooseFxLevel } from './settings';
import { createPostState, MAX_ZOOM } from './post-state';
import { spectacleQualityPresets } from '../../../data/spectacle-quality';

const def = spectacle.post!;

describe('post-processing state', () => {
  it('a hit pulses the colour fringe above its resting value and fades back within the decay time', () => {
    const s = createPostState();
    const rest = s.step(0.016, def, true, 1).chroma;
    expect(rest).toBeCloseTo(def.chromatic.base);
    s.hit(1);
    const peak = s.step(0, def, true, 1).chroma;
    expect(peak).toBeGreaterThan(rest + 0.5);
    expect(s.step(def.chromatic.decay + 0.01, def, true, 1).chroma).toBeCloseTo(rest);
  });

  it('the zoom punch is bounded, decays and scales with the pack and the intensity', () => {
    const s = createPostState();
    s.punch(1);
    const z = s.step(0, def, true, 1).zoom;
    expect(z).toBeGreaterThan(0);
    expect(z).toBeLessThanOrEqual(MAX_ZOOM);
    expect(s.step(2, def, true, 1).zoom).toBe(0);
    s.punch(1);
    expect(s.step(0, def, true, 0).zoom).toBe(0);
  });

  it('is neutral when disabled, and when every strength is zero', () => {
    const s = createPostState();
    s.hit(1);
    expect(s.step(0.01, def, false, 1).neutral).toBe(true);
    const flat = {
      ...def,
      chromatic: { ...def.chromatic, base: 0 },
      vignette: 0,
      grain: 0,
      scanlines: 0,
    };
    expect(createPostState().step(0.01, flat, true, 1).neutral).toBe(true);
  });
});

describe('fx quality', () => {
  it('?fx= wins over the remembered level; unknown values are ignored; high by default', () => {
    expect(chooseFxLevel('?fx=low', 'high')).toBe('low');
    expect(chooseFxLevel('', 'medium')).toBe('medium');
    expect(chooseFxLevel('?fx=ultra', 'bogus')).toBe('high');
    expect(chooseFxLevel('', null)).toBe('high');
  });

  it('the levels only ever grow from low to high, and low has no post-processing', () => {
    const { low, medium, high } = spectacleQualityPresets;
    expect(low.post).toBe(0);
    for (const k of Object.keys(low) as (keyof typeof low)[]) {
      expect(low[k]).toBeLessThanOrEqual(medium[k]);
      expect(medium[k]).toBeLessThanOrEqual(high[k]);
    }
  });
});
