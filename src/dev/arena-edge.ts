/** Geometry for drawing the arena boundary in the debug overlay (pure, so it is unit-tested). */

export interface ArenaCircle {
  /** Screen position of the arena center (the world origin), px. */
  x: number;
  y: number;
  /** Radius in px. */
  radius: number;
}

/** The arena circle on screen. `scale` is px per world unit. Fills `out`. */
export function arenaCircle(
  out: ArenaCircle,
  arenaRadius: number,
  camera: { x: number; y: number },
  view: { width: number; height: number },
  screen: { width: number; height: number },
): ArenaCircle {
  const scale = screen.width / view.width;
  out.x = screen.width / 2 + (0 - camera.x) * scale;
  out.y = screen.height / 2 - (0 - camera.y) * (screen.height / view.height);
  out.radius = arenaRadius * scale;
  return out;
}

/** Distance from a point to the arena edge: positive inside, negative outside. */
export function distanceToEdge(x: number, y: number, arenaRadius: number): number {
  return arenaRadius - Math.hypot(x, y);
}

/**
 * Where on the arena edge to put its label: the edge point in the direction of `from` (the camera
 * or ship) as seen from the arena center, or straight up when `from` is at the center. Returns the
 * world position and fills `out`.
 */
export function nearestEdgePoint(
  out: { x: number; y: number },
  from: { x: number; y: number },
  arenaRadius: number,
): { x: number; y: number } {
  const d = Math.hypot(from.x, from.y);
  if (d < 1e-6) {
    out.x = 0;
    out.y = arenaRadius;
  } else {
    out.x = (from.x / d) * arenaRadius;
    out.y = (from.y / d) * arenaRadius;
  }
  return out;
}
