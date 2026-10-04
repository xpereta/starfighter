import { clamp } from '../../core/math';

/** Pure placement and text for the rescue pod HUD (the canvas drawing is in pods-hud.ts). */

/** Smallest rescue-progress ring radius (px), so it stays readable at maximum zoom-out. */
const MIN_RING = 20;
const RING_GAP = 9; // px between the pod's body ring and the progress ring
const PIP_GAP = 7; // px between hit-point pips

/** Radius in px of the progress ring around a pod: outside its body, never below a readable minimum. */
export function progressRingRadius(podRadius: number, pxPerUnit: number): number {
  return Math.max(MIN_RING, podRadius * pxPerUnit + RING_GAP);
}

/** End angle (canvas radians) of the clockwise progress arc that starts at 12 o'clock. */
export function progressEnd(progress: number): number {
  return -Math.PI / 2 + clamp(progress, 0, 1) * Math.PI * 2;
}

/** Radius in px of the rescue-radius circle (how close you must be). */
export function rescueRingRadius(rescueRadius: number, pxPerUnit: number): number {
  return rescueRadius * pxPerUnit;
}

/** x offsets (px, centered on 0) of `hp` hit-point pips in a row. */
export function pipOffsets(hp: number, out: number[] = []): number[] {
  out.length = 0;
  const n = Math.max(0, Math.round(hp));
  for (let i = 0; i < n; i++) out.push((i - (n - 1) / 2) * PIP_GAP);
  return out;
}

/** Text next to the pod's edge arrow: its distance in world units. */
export function podDistanceLabel(distance: number): string {
  return `POD ${Math.round(distance)} u`;
}

/** Label above the ring: rescue progress once it has started, otherwise a prompt. */
export function podLabel(progress: number): string {
  return progress > 0.005 ? `RESCUE ${Math.round(clamp(progress, 0, 1) * 100)}%` : 'RESCUE';
}
