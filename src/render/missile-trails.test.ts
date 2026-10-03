import { describe, expect, it } from 'vitest';
import { createTrailStore, TRAIL_FADE_SECONDS, TRAIL_POINTS } from './missile-trails';

interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  alpha: number;
}

/** A tiny stand-in for the missile pool: parallel arrays that swap-remove like the real one. */
class FakePool {
  uid: number[] = [];
  x: number[] = [];
  y: number[] = [];
  add(uid: number, x: number, y: number): void {
    this.uid.push(uid);
    this.x.push(x);
    this.y.push(y);
  }
  remove(index: number): void {
    const last = this.uid.length - 1;
    this.uid[index] = this.uid[last]!;
    this.x[index] = this.x[last]!;
    this.y[index] = this.y[last]!;
    this.uid.pop();
    this.x.pop();
    this.y.pop();
  }
  arrays() {
    return {
      uids: Float32Array.from(this.uid),
      xs: Float32Array.from(this.x),
      ys: Float32Array.from(this.y),
      count: this.uid.length,
    };
  }
}

const segments = (store: ReturnType<typeof createTrailStore>): Segment[] => {
  const out: Segment[] = [];
  store.forEachSegment((x1, y1, x2, y2, alpha) => out.push({ x1, y1, x2, y2, alpha }));
  return out;
};

function frame(
  store: ReturnType<typeof createTrailStore>,
  pool: FakePool,
  tick: number,
  dt = 1 / 60,
): void {
  const a = pool.arrays();
  store.update(a.uids, a.xs, a.ys, a.count, tick, dt);
}

describe('missile trails', () => {
  it('records one point per simulation tick, however many frames are drawn', () => {
    const store = createTrailStore(4);
    const pool = new FakePool();
    pool.add(1, 0, 0);
    frame(store, pool, 1);
    pool.x[0] = 10;
    frame(store, pool, 2);
    frame(store, pool, 2); // same tick: no new point
    frame(store, pool, 2);
    const segs = segments(store);
    expect(segs).toHaveLength(1);
    expect(segs[0]).toMatchObject({ x1: 0, x2: 10 });
  });

  it('draws oldest to newest with alpha rising toward the missile, and wraps the ring', () => {
    const store = createTrailStore(2);
    const pool = new FakePool();
    pool.add(1, 0, 0);
    for (let t = 1; t <= TRAIL_POINTS + 6; t++) {
      pool.x[0] = t;
      frame(store, pool, t);
    }
    const segs = segments(store);
    expect(segs).toHaveLength(TRAIL_POINTS - 1); // never more than the ring holds
    for (let i = 1; i < segs.length; i++) {
      expect(segs[i]!.x1).toBe(segs[i - 1]!.x2); // continuous, oldest first
      expect(segs[i]!.alpha).toBeGreaterThan(segs[i - 1]!.alpha);
    }
    expect(segs[segs.length - 1]!.alpha).toBe(1);
    expect(segs[segs.length - 1]!.x2).toBe(TRAIL_POINTS + 6); // ends at the missile
  });

  it('keeps each trail with its missile when the pool swaps slots', () => {
    const store = createTrailStore(4);
    const pool = new FakePool();
    pool.add(10, 0, 0);
    pool.add(20, 100, 100);
    pool.add(30, 200, 200);
    frame(store, pool, 1);
    for (let t = 2; t <= 4; t++) {
      for (let i = 0; i < pool.x.length; i++) pool.x[i]! += 1;
      frame(store, pool, t);
    }
    pool.remove(0); // missile 30 moves into slot 0
    for (let i = 0; i < pool.x.length; i++) pool.x[i]! += 1;
    frame(store, pool, 5);
    // The trail that starts at x=200 still continues from 200 (no jump to another missile's path).
    const fromThirty = segments(store).filter((s) => s.x1 >= 200);
    expect(fromThirty.length).toBeGreaterThan(0);
    for (const s of fromThirty) expect(s.x2 - s.x1).toBeCloseTo(1);
    const jumps = segments(store).filter((s) => Math.abs(s.x2 - s.x1) > 1.5);
    expect(jumps).toEqual([]);
  });

  it('keeps fading a trail after its missile is gone, then frees the slot', () => {
    const store = createTrailStore(2);
    const pool = new FakePool();
    pool.add(1, 0, 0);
    for (let t = 1; t <= 5; t++) {
      pool.x[0] = t;
      frame(store, pool, t);
    }
    expect(store.active).toBe(1);
    pool.remove(0);
    frame(store, pool, 6, 0.1);
    const early = segments(store);
    expect(early.length).toBeGreaterThan(0);
    const earlyAlpha = early[early.length - 1]!.alpha;
    expect(earlyAlpha).toBeLessThan(1);
    frame(store, pool, 7, 0.1);
    expect(segments(store)[segments(store).length - 1]!.alpha).toBeLessThan(earlyAlpha);
    for (let i = 0; i < 10; i++) frame(store, pool, 8 + i, TRAIL_FADE_SECONDS / 4);
    expect(store.active).toBe(0);
    expect(segments(store)).toEqual([]);
  });

  it('reuses a freed slot for a new missile with a fresh trail', () => {
    const store = createTrailStore(1);
    const pool = new FakePool();
    pool.add(1, 0, 0);
    frame(store, pool, 1);
    pool.x[0] = 5;
    frame(store, pool, 2);
    pool.remove(0);
    frame(store, pool, 3, TRAIL_FADE_SECONDS + 0.1); // fades out and frees the only slot
    expect(store.active).toBe(0);
    pool.add(2, 50, 50);
    frame(store, pool, 4);
    pool.x[0] = 55;
    frame(store, pool, 5);
    const segs = segments(store);
    expect(segs).toHaveLength(1);
    expect(segs[0]).toMatchObject({ x1: 50, x2: 55 }); // nothing left over from missile 1
  });

  it('copes with more missiles than trail slots: the extra ones just have no trail', () => {
    const store = createTrailStore(2);
    const pool = new FakePool();
    for (let i = 0; i < 5; i++) pool.add(i, i * 10, 0);
    frame(store, pool, 1);
    for (let i = 0; i < 5; i++) pool.x[i]! += 1;
    frame(store, pool, 2);
    expect(store.active).toBe(2);
    expect(segments(store)).toHaveLength(2);
  });

  it('clear() forgets everything', () => {
    const store = createTrailStore(2);
    const pool = new FakePool();
    pool.add(1, 0, 0);
    frame(store, pool, 1);
    pool.x[0] = 1;
    frame(store, pool, 2);
    store.clear();
    expect(store.active).toBe(0);
    expect(segments(store)).toEqual([]);
  });
});
