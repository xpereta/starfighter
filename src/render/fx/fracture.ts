import type { Rng } from '../../core/rng/rng';
import { polygonArea, type Point } from '../style';

/** A piece may not be smaller than this share of the whole silhouette. */
export const MIN_PIECE_SHARE = 0.04;
/** Most points a single piece may have (the pieces' vertex budget). */
export const MAX_PIECE_POINTS = 20;
/** How far a fracture line may be pushed off the centre of the piece it cuts, in piece sizes. */
const OFF_CENTRE = 0.3;
/** Tries per wanted piece before giving up (a cut that makes a sliver is retried). */
const TRIES_PER_PIECE = 6;

export function polygonCentroid(p: readonly Point[]): Point {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i]!;
    const [x2, y2] = p[(i + 1) % p.length]!;
    const f = x1 * y2 - x2 * y1;
    a += f;
    cx += (x1 + x2) * f;
    cy += (y1 + y2) * f;
  }
  if (Math.abs(a) < 1e-12) {
    // Degenerate: the plain average of the points.
    const n = p.length || 1;
    return [p.reduce((s, q) => s + q[0], 0) / n, p.reduce((s, q) => s + q[1], 0) / n];
  }
  return [cx / (3 * a), cy / (3 * a)];
}

/** The part of a polygon where `side * (nx*x + ny*y - d) >= 0` (one half-plane), duplicates removed. */
function clipSide(p: readonly Point[], nx: number, ny: number, d: number, side: 1 | -1): Point[] {
  const out: Point[] = [];
  const push = (q: Point): void => {
    const last = out[out.length - 1];
    if (!last || Math.abs(last[0] - q[0]) > 1e-9 || Math.abs(last[1] - q[1]) > 1e-9) out.push(q);
  };
  for (let i = 0; i < p.length; i++) {
    const a = p[i]!;
    const b = p[(i + 1) % p.length]!;
    const da = side * (nx * a[0] + ny * a[1] - d);
    const db = side * (nx * b[0] + ny * b[1] - d);
    if (da >= 0) push(a);
    if (da >= 0 !== db >= 0) {
      const t = da / (da - db);
      push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  if (out.length > 1) {
    const f = out[0]!;
    const l = out[out.length - 1]!;
    if (Math.abs(f[0] - l[0]) < 1e-9 && Math.abs(f[1] - l[1]) < 1e-9) out.pop();
  }
  return out;
}

/**
 * Cuts a silhouette into `count` pieces along seeded fracture lines: repeatedly takes a piece
 * (the bigger, the likelier), cuts it with a line through a point near its centre at a random
 * angle, and keeps the cut when neither side is a sliver. The result has between 1 and `count`
 * pieces, covers the silhouette exactly, and depends only on the polygon, `count` and the stream.
 */
export function fracture(polygon: readonly Point[], count: number, rng: Rng): Point[][] {
  const total = polygonArea(polygon);
  const minArea = total * MIN_PIECE_SHARE;
  const pieces: Point[][] = [polygon.map((p) => [p[0], p[1]] as Point)];
  const areas = [total];
  let tries = 0;
  while (pieces.length < count && tries < count * TRIES_PER_PIECE) {
    tries++;
    // Pick a piece, weighted by area.
    let pick = rng.next() * areas.reduce((s, a) => s + a, 0);
    let idx = 0;
    for (; idx < areas.length - 1; idx++) {
      pick -= areas[idx]!;
      if (pick <= 0) break;
    }
    const p = pieces[idx]!;
    const [cx, cy] = polygonCentroid(p);
    let w = 0;
    for (const q of p) w = Math.max(w, Math.hypot(q[0] - cx, q[1] - cy));
    const px = cx + (rng.next() * 2 - 1) * w * OFF_CENTRE;
    const py = cy + (rng.next() * 2 - 1) * w * OFF_CENTRE;
    const angle = rng.range(0, Math.PI);
    const nx = Math.cos(angle);
    const ny = Math.sin(angle);
    const d = nx * px + ny * py;
    const a = clipSide(p, nx, ny, d, 1);
    const b = clipSide(p, nx, ny, d, -1);
    if (a.length < 3 || b.length < 3) continue;
    if (a.length > MAX_PIECE_POINTS || b.length > MAX_PIECE_POINTS) continue;
    const areaA = polygonArea(a);
    const areaB = polygonArea(b);
    if (areaA < minArea || areaB < minArea) continue;
    pieces[idx] = a;
    areas[idx] = areaA;
    pieces.push(b);
    areas.push(areaB);
  }
  return pieces;
}
