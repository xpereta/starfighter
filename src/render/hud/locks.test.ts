import { describe, expect, it } from 'vitest';
import { viewSize } from '../../core/camera/view';
import { worldToScreen } from './layout';
import {
  createLockRing,
  lockDebugLabel,
  lockPanel,
  lockRingAt,
  orderLabelOffset,
  RING_MIN_PX,
  ringRadiusPx,
  sweepEnd,
} from './locks';

const screen = { width: 1280, height: 800 };
const view = { width: 1600, height: 1000 }; // 0.8 px per world unit
const cam = { x: 0, y: 0 };

describe('ringRadiusPx', () => {
  it('scales with the body and the zoom, but never goes below the readable minimum', () => {
    expect(ringRadiusPx(30, 1)).toBeGreaterThan(ringRadiusPx(30, 0.5));
    expect(ringRadiusPx(60, 1)).toBeGreaterThan(ringRadiusPx(30, 1));
    // Zoomed far out (7800 u wide on 1280 px) a 30 u target is a few pixels: the ring stays readable.
    expect(ringRadiusPx(30, 1280 / 7800)).toBe(RING_MIN_PX);
    expect(ringRadiusPx(1, 0.001)).toBe(RING_MIN_PX);
  });

  it('is bigger than the body it circles', () => {
    expect(ringRadiusPx(100, 1)).toBeGreaterThan(100);
  });
});

describe('lockRingAt', () => {
  it('places the ring on the target at the screen position, with the screen radius', () => {
    const ring = createLockRing();
    const on = lockRingAt(ring, { x: 100, y: 50, radius: 30 }, cam, view, screen);
    const expected = { x: 0, y: 0 };
    worldToScreen(expected, 100, 50, cam, view, screen);
    expect(on).toBe(true);
    expect(ring.x).toBeCloseTo(expected.x);
    expect(ring.y).toBeCloseTo(expected.y);
    expect(ring.radius).toBeCloseTo(ringRadiusPx(30, 0.8));
  });

  it('works at the largest zoom-out and on a different screen shape', () => {
    const wide = viewSize(7800, 21 / 9);
    const ultra = { width: 2520, height: 1080 };
    const ring = createLockRing();
    expect(lockRingAt(ring, { x: 0, y: 0, radius: 30 }, cam, wide, ultra)).toBe(true);
    expect(ring.x).toBeCloseTo(1260);
    expect(ring.y).toBeCloseTo(540);
    expect(ring.radius).toBe(RING_MIN_PX);
  });

  it('is off screen only when the whole ring is outside the screen', () => {
    const ring = createLockRing();
    expect(lockRingAt(ring, { x: 5000, y: 0, radius: 30 }, cam, view, screen)).toBe(false);
    // Center just outside the right edge (800 u): the ring still overlaps the screen.
    expect(lockRingAt(ring, { x: 805, y: 0, radius: 30 }, cam, view, screen)).toBe(true);
    expect(lockRingAt(ring, { x: -5000, y: 3000, radius: 30 }, cam, view, screen)).toBe(false);
  });

  it('follows the camera', () => {
    const ring = createLockRing();
    lockRingAt(ring, { x: 500, y: 0, radius: 30 }, { x: 500, y: 0 }, view, screen);
    expect(ring.x).toBeCloseTo(640);
  });
});

describe('sweepEnd', () => {
  it('starts at 12 o clock and fills clockwise to a full circle', () => {
    expect(sweepEnd(0, 1)).toBeCloseTo(-Math.PI / 2);
    expect(sweepEnd(0.5, 1)).toBeCloseTo(Math.PI / 2); // half way: 6 o clock
    expect(sweepEnd(1, 1)).toBeCloseTo(-Math.PI / 2 + Math.PI * 2);
  });

  it('is clamped, and depends on the lock time', () => {
    expect(sweepEnd(5, 1)).toBeCloseTo(sweepEnd(1, 1));
    expect(sweepEnd(-1, 1)).toBeCloseTo(sweepEnd(0, 1));
    expect(sweepEnd(0.5, 2)).toBeCloseTo(sweepEnd(0.25, 1));
  });
});

describe('orderLabelOffset', () => {
  it('puts the number at the upper right (screen y is down), outside the ring', () => {
    const { dx, dy } = orderLabelOffset(20);
    expect(dx).toBeGreaterThan(0);
    expect(dy).toBeLessThan(0);
    expect(Math.hypot(dx, dy)).toBeGreaterThan(20);
  });
});

describe('lockPanel', () => {
  it('shows NO LOCK without locks, even when the cooldown is over', () => {
    const p = lockPanel(0, 3, 0, 4);
    expect(p.locksText).toBe('LOCKS 0/3');
    expect(p.salvoText).toBe('NO LOCK');
    expect(p.ready).toBe(false);
    expect(p.readiness).toBe(1);
  });

  it('shows READY with a lock and no cooldown', () => {
    const p = lockPanel(2, 3, 0, 4);
    expect(p.locksText).toBe('LOCKS 2/3');
    expect(p.salvoText).toBe('SALVO READY');
    expect(p.ready).toBe(true);
  });

  it('shows the cooldown time and a filling bar after a launch', () => {
    const p = lockPanel(2, 3, 2.5, 4);
    expect(p.salvoText).toBe('SALVO 2.5s');
    expect(p.ready).toBe(false);
    expect(p.readiness).toBeCloseTo(0.375);
    expect(lockPanel(2, 3, 4, 4).readiness).toBe(0);
  });

  it('can hold more locks than the limit when a wingman was lost', () => {
    expect(lockPanel(3, 2, 0, 4).locksText).toBe('LOCKS 3/2');
  });
});

describe('lockDebugLabel', () => {
  it('names the lock order, or the acquisition progress, with the grace when it is running', () => {
    expect(lockDebugLabel(2, 0, 1, 0)).toBe('LOCK #2');
    expect(lockDebugLabel(1, 0, 1, 0.25)).toBe('LOCK #1 (grace 0.25s)');
    expect(lockDebugLabel(0, 0.62, 1, 0)).toBe('ACQUIRING 62%');
    expect(lockDebugLabel(0, 5, 1, 0.1)).toBe('ACQUIRING 100% (grace 0.10s)');
  });
});
