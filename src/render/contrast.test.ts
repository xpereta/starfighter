import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  deltaE76,
  lab,
  luminance,
  luminanceOfHex,
  luminancePercentile,
  measureEntity,
  srgbToLinear,
} from './contrast';

/** A w x h RGBA picture filled with one colour. */
function picture(w: number, h: number, rgb: [number, number, number]): Uint8Array {
  const p = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) p.set([...rgb, 255], i * 4);
  return p;
}
function rect(
  p: Uint8Array,
  w: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  rgb: [number, number, number],
): void {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) p.set([...rgb, 255], (y * w + x) * 4);
}

describe('colour maths', () => {
  it('matches the WCAG reference values', () => {
    expect(luminance(255, 255, 255)).toBeCloseTo(1, 6);
    expect(luminance(0, 0, 0)).toBe(0);
    expect(contrastRatio(1, 0)).toBeCloseTo(21, 6);
    expect(contrastRatio(0.5, 0.5)).toBe(1);
    // #767676 on white is the classic 4.54:1.
    expect(contrastRatio(luminanceOfHex(0x767676), 1)).toBeCloseTo(4.54, 2);
    expect(srgbToLinear(255)).toBeCloseTo(1, 6);
  });
  it('is symmetric and gives the Lab of white and black', () => {
    expect(contrastRatio(0.2, 0.7)).toBe(contrastRatio(0.7, 0.2));
    expect(lab(255, 255, 255)[0]).toBeCloseTo(100, 0);
    expect(lab(0, 0, 0)[0]).toBeCloseTo(0, 0);
  });
  it('colour difference: zero for the same colour, large for black and white', () => {
    expect(deltaE76([10, 20, 30], [10, 20, 30])).toBe(0);
    expect(deltaE76([0, 0, 0], [255, 255, 255])).toBeCloseTo(100, 0);
  });
});

describe('measureEntity', () => {
  const W = 40;
  const box = { x0: 0, y0: 0, x1: W, y1: W };

  it('a bright square on a dark background reads strongly, everywhere on its edge', () => {
    const before = picture(W, W, [5, 6, 13]);
    const after = before.slice();
    rect(after, W, 12, 12, 28, 28, [240, 240, 240]);
    const m = measureEntity(before, after, W, box);
    expect(m.area).toBe(16 * 16);
    expect(m.bodyRatio).toBeGreaterThan(10);
    expect(m.ratio).toBeGreaterThan(10);
    expect(m.edgeShare).toBe(1);
    expect(m.deltaEBody).toBeGreaterThan(50);
  });

  it('a dark square on a dark background does not read', () => {
    const before = picture(W, W, [10, 12, 24]);
    const after = before.slice();
    rect(after, W, 12, 12, 28, 28, [24, 26, 40]);
    const m = measureEntity(before, after, W, box);
    expect(m.area).toBeGreaterThan(0);
    expect(m.ratio).toBeLessThan(1.5);
    expect(m.edgeShare).toBe(0);
  });

  it('a dark body with a bright rim reads through its rim', () => {
    const before = picture(W, W, [8, 8, 16]);
    const after = before.slice();
    rect(after, W, 10, 10, 30, 30, [230, 230, 230]);
    rect(after, W, 12, 12, 28, 28, [30, 30, 40]);
    const m = measureEntity(before, after, W, box);
    expect(m.bodyRatio).toBeLessThan(m.rimRatio);
    expect(m.ratio).toBe(m.rimRatio);
    expect(m.rimRatio).toBeGreaterThan(3);
  });

  it('a bright entity on a bright background (a glare) fails', () => {
    const before = picture(W, W, [200, 160, 110]);
    const after = before.slice();
    rect(after, W, 12, 12, 28, 28, [215, 175, 125]);
    expect(measureEntity(before, after, W, box).ratio).toBeLessThan(1.3);
  });

  it('an entity that draws nothing does not read; one that fills the box has no background to compare', () => {
    const before = picture(W, W, [5, 5, 5]);
    expect(measureEntity(before, before, W, box).ratio).toBe(1);
    const filled = picture(W, W, [250, 250, 250]);
    expect(measureEntity(before, filled, W, box).ratio).toBe(1);
  });

  it('only looks inside its box', () => {
    const before = picture(W, W, [5, 5, 5]);
    const after = before.slice();
    rect(after, W, 30, 30, 38, 38, [255, 255, 255]); // outside the box below
    expect(measureEntity(before, after, W, { x0: 0, y0: 0, x1: 20, y1: 20 }).area).toBe(0);
  });
});

it('luminancePercentile finds the bright places of a picture', () => {
  const p = picture(20, 20, [0, 0, 0]);
  rect(p, 20, 0, 0, 20, 4, [255, 255, 255]); // the top fifth is white
  expect(luminancePercentile(p, 0.99, 1)).toBeCloseTo(1, 3);
  expect(luminancePercentile(p, 0.5, 1)).toBe(0);
});
