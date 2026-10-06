/** Pure placement for the MISSILE warning (the canvas drawing is in missile-warning-hud.ts). */

/** Distance (px) from the ship's screen position to the warning arrow. */
export const ARROW_RING = 70;
/** Radius (px) of the red marker around a missile that is on screen. */
export const MARKER_RADIUS = 20;

/**
 * Where the warning arrow sits and which way it points: on a ring around the ship, toward the
 * nearest missile. `worldAngle` is the world heading from the ship to the missile (counter-
 * clockwise); the screen's y runs down, so the canvas angle is its negative. Fills `out`.
 */
export function warningArrow(
  out: { x: number; y: number; angle: number },
  shipX: number,
  shipY: number,
  worldAngle: number,
  ring: number = ARROW_RING,
): { x: number; y: number; angle: number } {
  const angle = -worldAngle;
  out.angle = angle;
  out.x = shipX + Math.cos(angle) * ring;
  out.y = shipY + Math.sin(angle) * ring;
  return out;
}

/** Marker pulse (0..1) that quickens as impact nears: a slow throb far out, a fast one in the last second. */
export function markerPulse(time: number, eta: number): number {
  const hz = Number.isFinite(eta) ? 1.5 + 6 * Math.max(0, 1 - eta / 2) : 1.5;
  return 0.5 + 0.5 * Math.sin(time * hz * Math.PI * 2);
}
