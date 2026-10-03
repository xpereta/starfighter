import { describe, expect, it } from 'vitest';
import { cameraParams } from '../../data/tuning/camera';
import { viewSize } from '../core/camera/view';
import { coverTile, layerShift, streak, WIDEST_ASPECT } from './view';

describe('layerShift', () => {
  const T = 2400;
  it('scrolls slower than the camera for far layers, wrapping by whole tiles', () => {
    // Apparent star offset relative to the camera: shift - cam must equal -cam*depth (mod T).
    for (const depth of [0.1, 0.5, 1.2]) {
      for (const cam of [0, 137, 5000, -9000]) {
        const rel = layerShift(cam, depth, T) - cam + cam * depth;
        expect(Math.abs(rel / T - Math.round(rel / T))).toBeCloseTo(0, 6);
      }
    }
  });

  it('keeps the tiled field centered near the camera', () => {
    for (const cam of [0, 3000, -12345, 80000]) {
      // Pattern covers shift +- 1.5 tile; the camera must stay well inside it.
      expect(Math.abs(cam - layerShift(cam, 0.4, T))).toBeLessThanOrEqual(T);
    }
  });
});

describe('streak', () => {
  it('is invisible below half speed and grows with speed', () => {
    expect(streak(0.4)).toEqual({ length: 0, opacity: 0 });
    expect(streak(1).length).toBeGreaterThan(streak(0.75).length);
    expect(streak(1).opacity).toBeGreaterThan(streak(0.75).opacity);
  });
});

describe('coverTile', () => {
  it('exceeds the half-diagonal of the largest allowed view on every screen shape', () => {
    for (const maxWidth of [cameraParams.viewMax.max, 7800, 12000]) {
      const tile = coverTile(maxWidth);
      for (const aspect of [9 / 32, 0.5, 1, 1.6, 16 / 9, 21 / 9, WIDEST_ASPECT]) {
        const size = viewSize(maxWidth, aspect);
        expect(tile).toBeGreaterThanOrEqual(Math.hypot(size.width, size.height) / 2);
      }
    }
  });

  it('grows with the view and rounds to 100', () => {
    expect(coverTile(7800)).toBeGreaterThan(coverTile(4500));
    expect(coverTile(7800) % 100).toBe(0);
  });
});
