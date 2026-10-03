import { describe, expect, it } from 'vitest';
import { composite, contrastRatio, hexToRgb } from './panel-logic';
import { COLORS, DEFAULT_PANEL_OPACITY, MIN_PANEL_OPACITY } from './panel-style';

const WCAG_AA = 4.5;
const rgb = (hex: string) => hexToRgb(hex);

/** Worst-case game backdrops the panel can sit over (a see-through panel blends with them). */
const BACKDROPS = {
  black: rgb('#000000'),
  deepSpace: rgb('#05060d'),
  cyan: rgb('#4ee1ff'),
  enemyRed: rgb('#ff5a5f'),
  yellow: rgb('#fff27a'),
  white: rgb('#ffffff'),
};

describe('contrast helper', () => {
  it('matches known WCAG values', () => {
    expect(contrastRatio(rgb('#000000'), rgb('#ffffff'))).toBeCloseTo(21, 1);
    expect(contrastRatio(rgb('#777777'), rgb('#ffffff'))).toBeCloseTo(4.48, 1);
    expect(contrastRatio(rgb('#ffffff'), rgb('#ffffff'))).toBe(1);
  });
});

describe('panel colors', () => {
  it('light text on the opaque track reaches AA even at the lowest panel opacity over any backdrop', () => {
    for (const opacity of [MIN_PANEL_OPACITY, DEFAULT_PANEL_OPACITY, 1]) {
      for (const [name, bg] of Object.entries(BACKDROPS)) {
        const text = composite(rgb(COLORS.text), bg, opacity);
        const track = composite(rgb(COLORS.track), bg, opacity);
        expect(
          contrastRatio(text, track),
          `light on track, ${name}, ${opacity}`,
        ).toBeGreaterThanOrEqual(WCAG_AA);
      }
    }
  });

  it('dark text inside the fill reaches AA at the lowest panel opacity over any backdrop', () => {
    for (const opacity of [MIN_PANEL_OPACITY, DEFAULT_PANEL_OPACITY, 1]) {
      for (const [name, bg] of Object.entries(BACKDROPS)) {
        const text = composite(rgb(COLORS.fillText), bg, opacity);
        const fill = composite(rgb(COLORS.fill), bg, opacity);
        expect(
          contrastRatio(text, fill),
          `dark on fill, ${name}, ${opacity}`,
        ).toBeGreaterThanOrEqual(WCAG_AA);
      }
    }
  });

  it('the fill is clearly distinguishable from the track (the bar is visible)', () => {
    expect(contrastRatio(rgb(COLORS.fill), rgb(COLORS.track))).toBeGreaterThanOrEqual(3);
  });

  it('the changed marker and the outline stand out from the track', () => {
    expect(contrastRatio(rgb(COLORS.changed), rgb(COLORS.track))).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(rgb(COLORS.outline), rgb(COLORS.track))).toBeGreaterThanOrEqual(3);
  });

  it('the tooltip (opaque) is readable', () => {
    expect(contrastRatio(rgb(COLORS.text), rgb(COLORS.panel))).toBeGreaterThanOrEqual(7);
  });

  it('keeps the panel from becoming too transparent', () => {
    expect(MIN_PANEL_OPACITY).toBeGreaterThanOrEqual(0.7);
    expect(DEFAULT_PANEL_OPACITY).toBeGreaterThanOrEqual(MIN_PANEL_OPACITY);
  });
});
