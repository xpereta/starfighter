import { clamp, lerp } from '../core/math';

/** Reference screen (Steam Deck). Every screen shows the same world *area* as this one. */
export const REFERENCE_ASPECT = 1280 / 800;

/** World-space size of the view. `viewWidth` is the visible width on the reference aspect. */
export function viewSize(viewWidth: number, aspect: number): { width: number; height: number } {
  const area = (viewWidth * viewWidth) / REFERENCE_ASPECT;
  return { width: Math.sqrt(area * aspect), height: Math.sqrt(area / aspect) };
}

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
