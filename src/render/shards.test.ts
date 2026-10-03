import { describe, expect, it } from 'vitest';
import { qualityPresets } from '../../data/quality';
import { shardCount } from './shards';

describe('shardCount', () => {
  it('stays within [shardsMin, shardsMax] for every roll and every preset', () => {
    for (const q of Object.values(qualityPresets)) {
      for (let r = 0; r < 1; r += 0.01) {
        const n = shardCount(q, r);
        expect(n).toBeGreaterThanOrEqual(q.shardsMin);
        expect(n).toBeLessThanOrEqual(q.shardsMax);
      }
    }
  });

  it('covers 3..5 on the default (high) preset', () => {
    const seen = new Set([0, 0.34, 0.67, 0.99].map((r) => shardCount(qualityPresets.high, r)));
    expect([...seen].sort()).toEqual([3, 4, 5]);
  });

  it('tolerates a swapped min/max', () => {
    expect(shardCount({ shardsMin: 5, shardsMax: 3 }, 0.99)).toBe(5);
  });
});
