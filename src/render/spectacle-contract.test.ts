import { describe, expect, it } from 'vitest';
import { styles } from '../../data/styles';
import { spectacle as packSpectacle } from '../../data/styles/anime-spectacle/spectacle';
import { checkStyle, SHIP_KINDS } from './style';
import { buildStyles } from './style-active';
import {
  mergeSpectacle,
  validateBackdrop,
  validateCards,
  validateCombat,
  validatePost,
  validateShipFx,
  validateSpectacle,
  type SpectacleDef,
} from './spectacle-contract';

describe('the spectacle section of the style contract', () => {
  it('the anime-spectacle pack validates, and the whole style passes the style checks', () => {
    expect(validateSpectacle(packSpectacle)).toEqual([]);
    expect(checkStyle(styles['anime-spectacle']!)).toEqual([]);
  });

  it('only spectacle packs have one: plain, anime-80s and realistic are drawn exactly as before', () => {
    const built = buildStyles(styles);
    expect(built['plain']!.pack.spectacle).toBeNull();
    expect(built['anime-80s']!.pack.spectacle).toBeNull();
    expect(built['realistic']!.pack.spectacle).toBeNull();
    expect(built['anime-spectacle']!.pack.spectacle).not.toBeNull();
    // The parent's ships are inherited untouched; the Prototype 5 kinds are drawn by the pack itself.
    const p5 = [
      'gunship',
      'lancer',
      'capital',
      'capitalTurret',
      'capitalEngine',
      'capitalArmour',
      'capitalBridge',
      'capitalCore',
    ] as const;
    const ships = built['anime-spectacle']!.pack.ships;
    const parentShips = built['anime-80s']!.pack.ships;
    for (const k of SHIP_KINDS) {
      if ((p5 as readonly string[]).includes(k)) expect(ships[k], k).not.toEqual(parentShips[k]);
      else expect(ships[k], k).toEqual(parentShips[k]);
    }
    for (const k of p5) {
      expect(ships[k]!.polygon.length, k).toBeGreaterThan(8);
      expect(built['anime-spectacle']!.pack.deaths[k], k).toBeDefined();
    }
    // Deaths are the pack's own: the parent's made longer and scattered over every direction.
    const own = built['anime-spectacle']!.pack.deaths.fighter!;
    const parent = built['anime-80s']!.pack.deaths.fighter!;
    expect(own.debris.scatter).toBe(1);
    expect(own.debris.life[1]).toBeGreaterThan(parent.debris.life[1]);
    expect(own.secondary[0]!.delay[1]).toBeGreaterThan(parent.secondary[0]!.delay[1]);
    expect(built['anime-spectacle']!.warnings.join(' ')).not.toContain('invalid');
  });

  it('rejects numbers out of range and unknown sections', () => {
    const post = structuredClone(packSpectacle.post!);
    post.bloom.strength = 9;
    post.vignette = -1;
    expect(validatePost(post)).toHaveLength(2);
    expect(validateSpectacle({ nope: 1 } as unknown as SpectacleDef)).toEqual([
      'spectacle.nope is not a section',
    ]);
    expect(validateBackdrop({ palettes: [] } as unknown as never).length).toBeGreaterThan(0);
    expect(validateShipFx({} as never).length).toBeGreaterThan(0);
    expect(validateCombat({} as never).length).toBeGreaterThan(0);
    expect(validateCards({} as never).length).toBeGreaterThan(0);
  });

  it('an invalid spectacle falls back to the parent with a warning instead of breaking the pack', () => {
    const bad = structuredClone(packSpectacle);
    bad.post!.grain = 5;
    const built = buildStyles({
      ...styles,
      'anime-spectacle': { ...styles['anime-spectacle']!, spectacle: bad },
    });
    const r = built['anime-spectacle']!;
    expect(r.pack.spectacle).toBeNull(); // the parent (anime-80s) has none
    expect(r.warnings.join(' ')).toContain('spectacle is invalid');
  });

  it('merges section by section into independent copies; null switches it off', () => {
    const base: SpectacleDef = { post: packSpectacle.post! };
    const merged = mergeSpectacle({ cards: undefined }, base)!;
    expect(merged.post).toEqual(base.post);
    merged.post!.grain = 0.9; // a live panel edit must not write through to the data
    expect(base.post!.grain).not.toBe(0.9);
    expect(mergeSpectacle(null, base)).toBeNull();
    expect(mergeSpectacle(undefined, null)).toBeNull();
  });
});
