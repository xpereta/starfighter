import { describe, expect, it } from 'vitest';
import { createPool } from './pool';

describe('createPool', () => {
  it('never exceeds its capacity', () => {
    const pool = createPool(3, ['x']);
    expect([pool.spawn(), pool.spawn(), pool.spawn(), pool.spawn()]).toEqual([0, 1, 2, -1]);
    expect(pool.count).toBe(3);
  });

  it('reuses slots after removal and swaps the last item in', () => {
    const pool = createPool(3, ['x']);
    for (let i = 0; i < 3; i++) pool.data.x[pool.spawn()] = i + 1;
    pool.remove(0);
    expect(pool.count).toBe(2);
    expect(pool.data.x[0]).toBe(3);
    expect(pool.spawn()).toBe(2);
    expect(pool.count).toBe(3);
  });

  it('zeroes fields on spawn', () => {
    const pool = createPool(1, ['x']);
    pool.data.x[pool.spawn()] = 9;
    pool.remove(0);
    expect(pool.data.x[pool.spawn()]).toBe(0);
  });

  it('ignores out-of-range removals', () => {
    const pool = createPool(2, ['x']);
    pool.spawn();
    pool.remove(5);
    pool.remove(-1);
    expect(pool.count).toBe(1);
  });
});
