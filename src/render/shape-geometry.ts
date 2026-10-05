import type { Point } from './style';

/** Longest a mitred outline corner may stick out, in outline widths (sharp spikes are cut short). */
export const MITER_LIMIT = 2.5;

/** Signed area of a ring: positive when counter-clockwise. */
export function signedArea(p: readonly Point[]): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i]!;
    const [x2, y2] = p[(i + 1) % p.length]!;
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

/**
 * Triangles (flat x, y, z=0 triples) of an outline stroke along a closed ring, `width` thick,
 * on the outer side of the ring (or the inner side when `outward` is false, for a hole: the
 * stroke then goes into the hole, away from the material). Corners are mitred up to MITER_LIMIT.
 */
export function ringOutline(ring: readonly Point[], width: number, outward = true): number[] {
  const n = ring.length;
  const out: number[] = [];
  if (n < 3 || width <= 0) return out;
  // Outward normal of a counter-clockwise edge (dx, dy) is (dy, -dx).
  const side = (signedArea(ring) >= 0 ? 1 : -1) * (outward ? 1 : -1);
  const normals: Point[] = [];
  for (let i = 0; i < n; i++) {
    const [x1, y1] = ring[i]!;
    const [x2, y2] = ring[(i + 1) % n]!;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    normals.push([(side * dy) / len, (-side * dx) / len]);
  }
  const offsets: Point[] = [];
  for (let i = 0; i < n; i++) {
    const a = normals[(i + n - 1) % n]!;
    const b = normals[i]!;
    const denom = 1 + a[0] * b[0] + a[1] * b[1];
    let mx = a[0] + b[0];
    let my = a[1] + b[1];
    if (denom < 1e-6) {
      mx = b[0];
      my = b[1];
    } else {
      mx /= denom;
      my /= denom;
    }
    const m = Math.hypot(mx, my);
    if (m > MITER_LIMIT) {
      mx *= MITER_LIMIT / m;
      my *= MITER_LIMIT / m;
    }
    offsets.push([mx * width, my * width]);
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const [x1, y1] = ring[i]!;
    const [x2, y2] = ring[j]!;
    const [o1x, o1y] = offsets[i]!;
    const [o2x, o2y] = offsets[j]!;
    out.push(x1, y1, 0, x2, y2, 0, x2 + o2x, y2 + o2y, 0);
    out.push(x1, y1, 0, x2 + o2x, y2 + o2y, 0, x1 + o1x, y1 + o1y, 0);
  }
  return out;
}

/** The part of a polygon with y <= `yCut` (Sutherland-Hodgman against one half-plane). */
export function clipBelow(p: readonly Point[], yCut: number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i]!;
    const b = p[(i + 1) % p.length]!;
    const aIn = a[1] <= yCut;
    const bIn = b[1] <= yCut;
    if (aIn) out.push(a);
    if (aIn !== bIn) {
      const t = (yCut - a[1]) / (b[1] - a[1]);
      out.push([a[0] + (b[0] - a[0]) * t, yCut]);
    }
  }
  return out;
}

/**
 * The shadow shape shown for a `share` (0..1): the authored shadow polygon, cut by a line that
 * slides from its lowest point (share 0: nothing) to its highest (share 1: all of it).
 * Returns an empty array when nothing is left.
 */
export function shadowFor(shadow: readonly Point[], share: number): Point[] {
  if (share <= 0 || shadow.length < 3) return [];
  if (share >= 1) return [...shadow];
  let lo = Infinity;
  let hi = -Infinity;
  for (const [, y] of shadow) {
    lo = Math.min(lo, y);
    hi = Math.max(hi, y);
  }
  const cut = clipBelow(shadow, lo + (hi - lo) * share);
  return cut.length >= 3 ? cut : [];
}

/** A flat fan of triangles for a small disc (engine glow point). */
export function discTriangles(cx: number, cy: number, radius: number, segments: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < segments; k++) {
    const a0 = (k / segments) * Math.PI * 2;
    const a1 = ((k + 1) / segments) * Math.PI * 2;
    out.push(
      cx,
      cy,
      0,
      cx + Math.cos(a0) * radius,
      cy + Math.sin(a0) * radius,
      0,
      cx + Math.cos(a1) * radius,
      cy + Math.sin(a1) * radius,
      0,
    );
  }
  return out;
}
