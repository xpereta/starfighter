/** Heading and velocity indicators for the debug overlay (pure, so the maths is unit-tested). */

/** Length in px of the velocity vector: `basePx` at max speed, shorter when slower (same for every ship). */
export function velocityLength(speed: number, maxSpeed: number, basePx: number): number {
  return basePx * Math.max(0, speed / maxSpeed);
}

/**
 * End point on screen of a vector drawn from (x, y) in world direction (dirX, dirY) (y up, so it is
 * flipped for the screen). A zero direction gives the start point. Fills `out`.
 */
export function vectorEnd(
  out: { x: number; y: number },
  x: number,
  y: number,
  dirX: number,
  dirY: number,
  length: number,
): { x: number; y: number } {
  const mag = Math.hypot(dirX, dirY);
  if (mag < 1e-9) {
    out.x = x;
    out.y = y;
  } else {
    out.x = x + (dirX / mag) * length;
    out.y = y - (dirY / mag) * length;
  }
  return out;
}
