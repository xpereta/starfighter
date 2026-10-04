import { describe, expect, it } from 'vitest';
import { readoutLayout } from './readout-layout';

describe('readoutLayout', () => {
  const CHART_W = 180;
  const CHART_H = 90;

  it('keeps the whole column in the left strip, clear of the middle of the screen, on common sizes', () => {
    for (const [w, h] of [
      [1280, 800],
      [1920, 1080],
      [1366, 768],
      [800, 600],
    ] as const) {
      const lay = readoutLayout(7, CHART_H);
      const right = lay.chartX + CHART_W + 6; // the widest thing in the column
      expect(right).toBeLessThan(w * 0.3); // stays in the left strip, never near the centre
      expect(lay.boxY).toBeGreaterThan(60); // under the HUD's own text lines
      expect(lay.bottom).toBeLessThan(h * 0.65); // and leaves the bottom-left HUD alone
    }
  });

  it('stacks the text lines downward and puts the chart below the last one without overlap', () => {
    const lay = readoutLayout(6, CHART_H);
    expect(lay.lineY(1)).toBeGreaterThan(lay.lineY(0));
    expect(lay.chartY).toBeGreaterThan(lay.lineY(5));
    expect(lay.bottom).toBeGreaterThan(lay.chartY + CHART_H);
    expect(lay.boxY + lay.boxHeight).toBeGreaterThan(lay.lineY(5));
  });

  it('grows with the number of lines', () => {
    expect(readoutLayout(8, CHART_H).bottom).toBeGreaterThan(readoutLayout(5, CHART_H).bottom);
  });
});
