import { describe, expect, it } from 'vitest';
import { presentation } from '../../../data/styles/anime-spectacle/presentation';
import { portraitSeed, portraitSpec, portraitSvg } from './portrait';

const pal = presentation.portraits;

describe('portraits', () => {
  it('the same name always gives the same portrait', () => {
    expect(portraitSpec('Mara Vex', pal)).toEqual(portraitSpec('Mara Vex', pal));
    expect(portraitSvg(portraitSpec('Mara Vex', pal))).toBe(
      portraitSvg(portraitSpec('Mara Vex', pal)),
    );
  });

  it('different names mostly give different portraits', () => {
    const names = ['Mara Vex', 'Joss Hale', 'Ilya Frost', 'Tomas Reed', 'Anouk Dusk', 'Kenji Moth'];
    const svgs = new Set(names.map((n) => portraitSvg(portraitSpec(n, pal))));
    expect(svgs.size).toBeGreaterThanOrEqual(5);
  });

  it('only uses colours from the pack palette (the backdrop is a shade)', () => {
    for (const n of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']) {
      const s = portraitSpec(n, pal);
      expect(pal.helmets).toContain(s.helmet);
      expect(pal.visors).toContain(s.visor);
      expect(pal.accents).toContain(s.accent);
    }
  });

  it('draws valid svg markup', () => {
    const svg = portraitSvg(portraitSpec('Nadia Quill', pal));
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
    expect(svg).not.toContain('NaN');
    expect(svg).not.toContain('undefined');
  });

  it('seeds are stable 32-bit numbers', () => {
    expect(portraitSeed('Mara Vex')).toBe(portraitSeed('Mara Vex'));
    expect(portraitSeed('Mara Vex')).not.toBe(portraitSeed('Mara Vax'));
  });
});
