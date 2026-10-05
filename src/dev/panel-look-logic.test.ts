import { afterEach, describe, expect, it } from 'vitest';
import { styles } from '../../data/styles';
import { palette } from '../render/palette';
import { PALETTE_KEYS } from '../render/style';
import {
  activeStyle,
  buildStyles,
  initStyle,
  peekStyle,
  styleRevision,
  touchStyle,
} from '../render/style-active';
import {
  EDITABLE_COLORS,
  fromCss,
  LOOK_SLIDERS,
  otherStyle,
  styleToJson,
  themeToTs,
  toCss,
} from './panel-look-logic';

afterEach(() => initStyle('', null));

const anime = buildStyles(styles)['anime-80s']!.pack;

describe('Look panel logic', () => {
  it('edits only real palette roles, with ranges that match the contract', () => {
    for (const c of EDITABLE_COLORS) expect(PALETTE_KEYS).toContain(c.key);
    for (const s of LOOK_SLIDERS) {
      expect(s.def.min).toBe(0);
      expect(s.def.max).toBeGreaterThan(0);
      expect(s.def.note).toBeTruthy();
    }
  });

  it('colour conversion round-trips', () => {
    expect(toCss(0x07a1ff)).toBe('#07a1ff');
    expect(toCss(0x000001)).toBe('#000001');
    expect(fromCss('#07a1ff')).toBe(0x07a1ff);
    expect(fromCss(toCss(0xf2f6ff))).toBe(0xf2f6ff);
  });

  it('Save style writes the theme as JSON with readable colours', () => {
    const json = JSON.parse(styleToJson(anime)) as {
      id: string;
      theme: { palette: Record<string, string>; outlineWidth: number; outlineColor: string };
    };
    expect(json.id).toBe('anime-80s');
    expect(json.theme.palette.friendly).toBe(toCss(anime.theme.palette.friendly));
    expect(json.theme.outlineWidth).toBe(anime.theme.outlineWidth);
    expect(json.theme.outlineColor).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('theme.ts text lists every palette role and theme field', () => {
    const ts = themeToTs(anime.theme);
    for (const k of PALETTE_KEYS) expect(ts).toContain(`${k}: 0x`);
    for (const f of [
      'outlineWidth',
      'outlineColor',
      'shadowShare',
      'glow',
      'eyeColor',
      'speedLines',
    ])
      expect(ts).toContain(`${f}:`);
  });

  it('the peek style is another registered style', () => {
    expect(otherStyle(['plain', 'anime-80s'], 'plain')).toBe('anime-80s');
    expect(otherStyle(['plain', 'anime-80s'], 'anime-80s')).toBe('plain');
    expect(otherStyle(['plain'], 'plain')).toBe('plain');
  });
});

describe('peeking and live edits', () => {
  it('peeking shows another style and flips back, bumping the revision each time', () => {
    initStyle('?style=plain', null);
    const r0 = styleRevision();
    peekStyle('anime-80s');
    expect(activeStyle().manifest.id).toBe('anime-80s');
    expect(palette.friendly).toBe(anime.theme.palette.friendly);
    expect(styleRevision()).toBeGreaterThan(r0);
    peekStyle(null);
    expect(activeStyle().manifest.id).toBe('plain');
    expect(styleRevision()).toBeGreaterThan(r0 + 1);
  });

  it('peeking at the active style or an unknown one changes nothing', () => {
    initStyle('?style=plain', null);
    const r = styleRevision();
    peekStyle('plain');
    peekStyle('nope');
    expect(styleRevision()).toBe(r);
    expect(activeStyle().manifest.id).toBe('plain');
  });

  it('a live colour edit shows through the palette reader and bumps the revision', () => {
    initStyle('?style=plain', null);
    const before = palette.friendly;
    const r = styleRevision();
    activeStyle().theme.palette.friendly = 0x123456;
    touchStyle();
    expect(palette.friendly).toBe(0x123456);
    expect(styleRevision()).toBe(r + 1);
    activeStyle().theme.palette.friendly = before; // leave the shared pack as it was
  });
});
