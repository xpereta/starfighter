import { describe, expect, it } from 'vitest';
import { createTrail, createTrailSampler, TRAIL_JUMP } from './trail';

const points = (t: ReturnType<typeof createTrail>): number[] => {
  const out: number[] = [];
  t.forEach((x) => out.push(x));
  return out;
};

describe('trail ring', () => {
  it('visits points oldest to newest and overwrites the oldest when full', () => {
    const t = createTrail(3);
    for (let i = 1; i <= 5; i++) t.push(i, 0, false);
    expect(t.count).toBe(3);
    expect(t.pushed).toBe(5);
    expect(points(t)).toEqual([3, 4, 5]);
  });

  it('keeps flags with their points and clears completely', () => {
    const t = createTrail(4);
    t.push(1, 0, false);
    t.push(2, 0, true);
    const flags: boolean[] = [];
    t.forEach((_x, _y, f) => flags.push(f));
    expect(flags).toEqual([false, true]);
    t.clear();
    expect([t.count, t.pushed, points(t)]).toEqual([0, 0, []]);
  });
});

describe('trail sampler', () => {
  it('records one point per simulation tick, however many frames ask', () => {
    const t = createTrail(100);
    const s = createTrailSampler(t);
    s.sample(1, 0, 0, false);
    s.sample(1, 0, 0, false);
    s.sample(2, 5, 0, false);
    s.sample(2, 5, 0, false);
    expect(t.count).toBe(2);
  });

  it('clears when the tick goes backwards (restart or replay)', () => {
    const t = createTrail(100);
    const s = createTrailSampler(t);
    for (let i = 1; i <= 10; i++) s.sample(i, i, 0, false);
    s.sample(1, 0, 0, false);
    expect(t.count).toBe(1);
  });

  it('clears on a teleport (respawn) but not on normal fast flight', () => {
    const t = createTrail(100);
    const s = createTrailSampler(t);
    s.sample(1, 0, 0, false);
    s.sample(2, 10, 0, false); // 600 u/s is far below the jump limit
    expect(t.count).toBe(2);
    s.sample(3, TRAIL_JUMP * 3, 0, false);
    expect(t.count).toBe(1);
  });
});
