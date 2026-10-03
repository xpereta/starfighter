import { describe, expect, it } from 'vitest';
import { createRng } from './rng';

describe('createRng', () => {
  it('gives the same sequence for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('gives different sequences for different seeds', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });

  it('keeps values within range', () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const n = rng.next();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
      const r = rng.range(-5, 5);
      expect(r).toBeGreaterThanOrEqual(-5);
      expect(r).toBeLessThan(5);
      const k = rng.int(6);
      expect(Number.isInteger(k)).toBe(true);
      expect(k).toBeGreaterThanOrEqual(0);
      expect(k).toBeLessThan(6);
    }
  });
});
