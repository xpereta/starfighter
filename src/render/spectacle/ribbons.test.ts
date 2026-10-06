import { describe, expect, it } from 'vitest';
import { createGlowBatch } from './glow-batch';
import { createRibbonSet, drawRibbon } from './ribbons';

describe('ribbon set', () => {
  it('keeps a ring of points per emitter and skips points that barely moved', () => {
    const set = createRibbonSet(4, 5);
    for (let i = 0; i < 9; i++) set.push(7, i * 10, 0, 1, 1, 1);
    expect(set.emitterCount()).toBe(1);
    const slot = set.slotOf(7);
    expect(set.count(slot)).toBe(5); // never more than maxPoints; the oldest fall off
    expect(set.x(slot, 4)).toBe(80); // newest last
    expect(set.x(slot, 0)).toBe(40);
    set.push(7, 80.5, 0, 1, 1, 1); // barely moved
    expect(set.count(slot)).toBe(5);
    expect(set.keyOf(slot)).toBe(7);
  });

  it('ages points, drops old ones, and frees an emitter when it is empty', () => {
    const set = createRibbonSet(2, 8);
    set.push(1, 0, 0, 1, 0, 0);
    set.step(0.5, 1);
    set.push(1, 10, 0, 1, 0, 0);
    set.push(1, 20, 0, 1, 0, 0);
    set.step(0.6, 1); // the first point is 1.1 s old: gone
    const slot = set.slotOf(1);
    expect(set.count(slot)).toBe(2);
    expect(set.age(slot, 0)).toBeCloseTo(0.6);
    set.step(2, 1);
    expect(set.emitterCount()).toBe(0);
    expect(set.slotOf(1)).toBe(-1);
  });

  it('is hard-capped: a new emitter is skipped when the pool is full, a freed slot is reused', () => {
    const set = createRibbonSet(2, 4);
    set.push(1, 0, 0, 1, 1, 1);
    set.push(2, 0, 0, 1, 1, 1);
    set.push(3, 0, 0, 1, 1, 1);
    expect(set.emitterCount()).toBe(2);
    expect(set.slotOf(3)).toBe(-1);
    set.step(5, 1);
    set.push(3, 0, 0, 1, 1, 1);
    expect(set.slotOf(3)).toBeGreaterThanOrEqual(0);
    set.clear();
    expect(set.emitterCount()).toBe(0);
  });

  it('visits only emitters with a drawable ribbon (two points or more)', () => {
    const set = createRibbonSet(3, 4);
    set.push(1, 0, 0, 1, 1, 1);
    set.push(2, 0, 0, 1, 1, 1);
    set.push(2, 50, 0, 1, 1, 1);
    const seen: number[] = [];
    set.forEach((slot) => seen.push(set.keyOf(slot)));
    expect(seen).toEqual([2]);
  });

  it('draws a straight ribbon and a spiral into a batch within its vertex budget', () => {
    const set = createRibbonSet(2, 12);
    for (let i = 0; i < 12; i++) {
      set.push(1, i * 20, 0, 1, 1, 1);
      set.step(0.05, 3);
    }
    const slot = set.slotOf(1);
    const batch = createGlowBatch(6 * 11 * 3, 1, 'add');
    drawRibbon(batch, set, slot, { life: 2, width: 4, tailWidth: 0, alpha: 1, gain: 1 });
    const straight = batch.count;
    expect(straight).toBeGreaterThan(0);
    expect(straight).toBeLessThanOrEqual(6 * 11);
    batch.reset();
    drawRibbon(batch, set, slot, {
      life: 2,
      width: 3,
      tailWidth: 6,
      alpha: 0.5,
      gain: 1,
      strands: 3,
      amplitude: 10,
      turns: 1.5,
    });
    expect(batch.count).toBeGreaterThan(straight);
    expect(batch.count).toBeLessThanOrEqual(batch.capacity);
    batch.dispose();
  });
});
