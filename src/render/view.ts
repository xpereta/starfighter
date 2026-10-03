import { viewSize } from '../core/camera/view';
import { clamp, lerp } from '../core/math';

/**
 * Position of a parallax layer's group so its tiled star field always surrounds the camera.
 * `depth` < 1 scrolls slower than the world (far), > 1 faster (near). Stars live in a
 * `tile`-periodic pattern centered on the layer origin; the shift wraps by whole tiles.
 */
export function layerShift(cam: number, depth: number, tile: number): number {
  return cam * (1 - depth) + tile * Math.round((cam * depth) / tile);
}

const STREAK_START = 0.5; // speed factor where streaks begin to show
const STREAK_MAX_LENGTH = 110; // world units at full speed

/** Dust streaks fade in above half speed and lengthen with speed. */
export function streak(speedFactor: number): { length: number; opacity: number } {
  const t = clamp((speedFactor - STREAK_START) / (1 - STREAK_START), 0, 1);
  return { length: lerp(0, STREAK_MAX_LENGTH, t), opacity: t * 0.6 };
}

/** Widest screen shape we plan for (super-ultrawide). Tall phones in portrait are no worse. */
export const WIDEST_ASPECT = 32 / 9;

/**
 * Smallest parallax tile (world units, rounded up to 100) whose tiled field still covers the whole
 * screen at the largest allowed view width: the tile must exceed the view's half-diagonal.
 */
export function coverTile(maxViewWidth: number, aspect: number = WIDEST_ASPECT): number {
  const size = viewSize(maxViewWidth, aspect);
  return Math.ceil(Math.hypot(size.width, size.height) / 2 / 100) * 100;
}
