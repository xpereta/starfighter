import { describe, expect, it } from 'vitest';
import { styles } from '../../data/styles';
import { palette } from './palette';
import {
  checkStyle,
  EXPLOSION_KINDS,
  SHIP_KINDS,
  SOUND_EVENT_KEYS,
  type StyleManifest,
  type StyleRegistry,
} from './style';
import { activeStyle, buildStyles, chooseStyleId, initStyle, styleIds } from './style-active';

const manifest = (id: string, parent: string | null = null): StyleManifest => ({
  id,
  name: id,
  intent: 'test',
  parent,
  references: [],
  status: 'idea',
  notes: '',
});

describe('registry: the style checks over every pack in data/styles', () => {
  const resolved = buildStyles(styles);

  it('has plain, and every key is the pack id', () => {
    expect(styles.plain).toBeDefined();
    for (const [key, pack] of Object.entries(styles)) expect(pack.manifest.id).toBe(key);
  });

  for (const [id, pack] of Object.entries(styles)) {
    describe(id, () => {
      it('validates (manifest and every part present)', () => {
        expect(checkStyle(pack)).toEqual([]);
      });
      it('resolves to a complete pack', () => {
        const r = resolved[id]!.pack;
        expect(Object.keys(r.sounds).sort()).toEqual([...SOUND_EVENT_KEYS].sort());
        expect(Object.values(r.theme.palette).every(Number.isInteger)).toBe(true);
      });
      it('has an entry or an explicit silent for every event', () => {
        const r = resolved[id]!.pack;
        for (const key of SOUND_EVENT_KEYS) expect(r.sounds[key]).toBeDefined();
      });
      it('every ship and explosion kind it defines is a known kind', () => {
        for (const k of Object.keys(pack.ships ?? {})) expect(SHIP_KINDS).toContain(k);
        for (const k of Object.keys(pack.deaths ?? {})) expect(SHIP_KINDS).toContain(k);
        for (const k of Object.keys(pack.explosions ?? {})) expect(EXPLOSION_KINDS).toContain(k);
      });
      it('its parent exists', () => {
        const parent = pack.manifest.parent;
        if (parent) expect(styles[parent]).toBeDefined();
      });
    });
  }
});

describe('buildStyles', () => {
  it('needs plain', () => {
    expect(() => buildStyles({})).toThrow(/plain/);
  });

  it('missing parts come from the parent first, then plain', () => {
    const reg: StyleRegistry = {
      plain: styles.plain!,
      a: { manifest: manifest('a'), theme: { palette: { enemy: 1 } } },
      b: { manifest: manifest('b', 'a'), theme: { palette: { friendly: 2 } } },
    };
    const out = buildStyles(reg);
    expect(out.b!.pack.theme.palette.enemy).toBe(1);
    expect(out.b!.pack.theme.palette.friendly).toBe(2);
    expect(out.b!.pack.theme.palette.pod).toBe(out.plain!.pack.theme.palette.pod);
  });

  it('an unknown parent or a cycle falls back to plain with a warning', () => {
    const out = buildStyles({
      plain: styles.plain!,
      lost: { manifest: manifest('lost', 'nowhere') },
      x: { manifest: manifest('x', 'y') },
      y: { manifest: manifest('y', 'x') },
    });
    expect(out.lost!.warnings.join('\n')).toContain('not registered');
    expect(Object.values(out).every((r) => r.pack.sounds.Hit === 'silent')).toBe(true);
    expect(
      Object.values(out)
        .flatMap((r) => r.warnings)
        .join('\n'),
    ).toContain('cycle');
  });
});

describe('choosing a style', () => {
  const known = (id: string): boolean => id === 'plain' || id === 'other';

  it('?style= wins over the remembered choice', () => {
    expect(chooseStyleId('?style=other', 'plain', known)).toEqual({ id: 'other' });
  });
  it('uses the remembered choice without ?style=', () => {
    expect(chooseStyleId('?dev', 'other', known)).toEqual({ id: 'other' });
  });
  it('defaults to plain', () => {
    expect(chooseStyleId('', null, known)).toEqual({ id: 'plain' });
    expect(chooseStyleId('', 'gone', known)).toEqual({ id: 'plain' });
  });
  it('an unknown ?style= falls back to plain with a warning', () => {
    const r = chooseStyleId('?style=nope', 'other', known);
    expect(r.id).toBe('plain');
    expect(r.warning).toContain('nope');
  });
});

describe('the active style', () => {
  it('lists plain first, and the palette reader follows the active style', () => {
    expect(styleIds()[0]).toBe('plain');
    initStyle('?style=plain', null);
    expect(activeStyle().manifest.id).toBe('plain');
    expect(palette.friendly).toBe(0x4ee1ff);
    expect(Object.keys(palette)).toContain('background');
  });
});
