import type { PartKind, PartRole, Point, ShapePart } from '../../../src/render/style';

/**
 * Small helpers for authoring the layered ship models as data: half outlines mirrored into
 * silhouettes, rectangles, bars, regular polygons, and part constructors. Everything produces plain
 * `Point[]` and `ShapePart` objects (the contract in src/render/style.ts); coordinates are in
 * radius units, nose along +x, wings along y.
 */

const r4 = (n: number): number => Math.round(n * 1e4) / 1e4;
const pt = (x: number, y: number): Point => [r4(x), r4(y)];

/**
 * A symmetric silhouette from its upper half (y >= 0) listed from the nose to the tail. The first
 * point sits on the axis; the lower half is the mirror image, so the result is a closed ring.
 */
export function sym(half: readonly Point[]): Point[] {
  const lower = half
    .filter((p) => p[1] !== 0)
    .reverse()
    .map(([x, y]) => pt(x, -y));
  return [...half.map(([x, y]) => pt(x, y)), ...lower];
}

/** The lower half (y <= 0) of a silhouette given as its upper half: a hard shadow shape for the dark side. */
export function lowerHalf(half: readonly Point[]): Point[] {
  const first = half[0]!;
  const last = half[half.length - 1]!;
  const mirrored = half.map(([x, y]) => pt(x, -y));
  const ring = [...mirrored];
  if (last[1] !== 0) ring.push(pt(last[0], 0));
  if (first[1] !== 0) ring.unshift(pt(first[0], 0));
  // Close along the axis, a hair above it so the cut line is the terminator.
  return ring.map(([x, y]) => pt(x, y));
}

/** Axis-aligned rectangle by centre and size. */
export const rect = (cx: number, cy: number, w: number, h: number): Point[] => [
  pt(cx - w / 2, cy - h / 2),
  pt(cx + w / 2, cy - h / 2),
  pt(cx + w / 2, cy + h / 2),
  pt(cx - w / 2, cy + h / 2),
];

/** Regular polygon (a round thing) by centre, radius, sides and an optional squash along y. */
export const ngon = (cx: number, cy: number, r: number, n = 10, ry = r, rot = 0): Point[] =>
  Array.from({ length: n }, (_, i) => {
    const a = rot + (i / n) * Math.PI * 2;
    return pt(cx + Math.cos(a) * r, cy + Math.sin(a) * ry);
  });

/** A bar of width `w` from (x1, y1) to (x2, y2): a strut, a barrel, a pipe. */
export function bar(x1: number, y1: number, x2: number, y2: number, w: number): Point[] {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * (w / 2);
  const ny = (dx / len) * (w / 2);
  return [pt(x1 + nx, y1 + ny), pt(x2 + nx, y2 + ny), pt(x2 - nx, y2 - ny), pt(x1 - nx, y1 - ny)];
}

/** Moves points. */
export const shift = (p: readonly Point[], dx: number, dy: number): Point[] =>
  p.map(([x, y]) => pt(x + dx, y + dy));

/** Scales points about the origin. */
export const scale = (p: readonly Point[], sx: number, sy = sx): Point[] =>
  p.map(([x, y]) => pt(x * sx, y * sy));

interface Opts {
  /** Draw the mirror image across the long axis too. */
  m?: boolean;
  /** Exact colour instead of the role's. */
  c?: number;
}

const part = (kind: PartKind, role: PartRole, points: readonly Point[], o: Opts): ShapePart => ({
  kind,
  role,
  points,
  ...(o.m ? { mirror: true } : {}),
  ...(o.c !== undefined ? { color: o.c } : {}),
});

/** Filled polygons, by what they are. Role colours come from the theme; `c` overrides. */
export const hull = (p: readonly Point[], o: Opts = {}): ShapePart => part('hull', 'hull', p, o);
export const panel = (p: readonly Point[], o: Opts = {}): ShapePart => part('panel', 'panel', p, o);
export const dark = (p: readonly Point[], o: Opts = {}): ShapePart => part('panel', 'dark', p, o);
export const accent = (p: readonly Point[], o: Opts = {}): ShapePart =>
  part('panel', 'accent', p, o);
export const glass = (p: readonly Point[], o: Opts = {}): ShapePart =>
  part('canopy', 'glass', p, o);
export const light = (p: readonly Point[], o: Opts = {}): ShapePart =>
  part('greeble', 'glow', p, o);
export const nacelle = (p: readonly Point[], o: Opts & { role?: PartRole } = {}): ShapePart =>
  part('nacelle', o.role ?? 'hull', p, o);
export const flap = (p: readonly Point[], o: Opts & { role?: PartRole } = {}): ShapePart =>
  part('flap', o.role ?? 'panel', p, o);
export const greeble = (p: readonly Point[], o: Opts & { role?: PartRole } = {}): ShapePart =>
  part('greeble', o.role ?? 'dark', p, o);
export const hardpoint = (p: readonly Point[], o: Opts & { role?: PartRole } = {}): ShapePart =>
  part('hardpoint', o.role ?? 'dark', p, o);
/** Soot, scorch and scars: dark polygons, usually on one side only. */
export const scar = (p: readonly Point[], o: Opts = {}): ShapePart =>
  part('scar', 'dark', p, { c: 0x1d1c1b, ...o });

/** A panel line or a strip: a polyline of a given width (radius units). */
export const line = (
  p: readonly Point[],
  width = 0.01,
  o: Opts & { role?: PartRole } = {},
): ShapePart => ({
  ...part('line', o.role ?? 'dark', p, o),
  width,
});

/** A closed outline as a line (the first point is repeated at the end). */
export const outline = (
  p: readonly Point[],
  width = 0.01,
  o: Opts & { role?: PartRole } = {},
): ShapePart => line([...p, p[0]!], width, o);

/** A row of `n` small blocks along x (vents, windows, lights). */
export function row(
  x0: number,
  x1: number,
  y: number,
  w: number,
  h: number,
  n: number,
  make: (p: Point[]) => ShapePart,
): ShapePart[] {
  return Array.from({ length: n }, (_, i) =>
    make(rect(n === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * i) / (n - 1), y, w, h)),
  );
}

/** A point on the segment a to b at fraction t (to anchor stripes and bands on an edge). */
export const lerp = (a: Point, b: Point, t: number): Point =>
  pt(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);

/** The part of `subject` inside the convex polygon `clip` (Sutherland-Hodgman): stripes and decals that stay on a hull. */
export function clipConvex(subject: readonly Point[], clip: readonly Point[]): Point[] {
  let area = 0;
  for (let i = 0; i < clip.length; i++) {
    const [x1, y1] = clip[i]!;
    const [x2, y2] = clip[(i + 1) % clip.length]!;
    area += x1 * y2 - x2 * y1;
  }
  const sign = area >= 0 ? 1 : -1;
  let out: Point[] = subject.map(([x, y]) => [x, y] as Point);
  for (let i = 0; i < clip.length && out.length > 0; i++) {
    const a = clip[i]!;
    const b = clip[(i + 1) % clip.length]!;
    const inside = (p: Point): boolean =>
      sign * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) >= 0;
    const cross = (p: Point, q: Point): Point => {
      const dx = q[0] - p[0];
      const dy = q[1] - p[1];
      const ex = b[0] - a[0];
      const ey = b[1] - a[1];
      const t = (ex * (a[1] - p[1]) - ey * (a[0] - p[0])) / (ex * dy - ey * dx || 1e-12);
      return pt(p[0] + dx * t, p[1] + dy * t);
    };
    const input = out;
    out = [];
    for (let j = 0; j < input.length; j++) {
      const p = input[j]!;
      const q = input[(j + 1) % input.length]!;
      if (inside(p)) {
        out.push(p);
        if (!inside(q)) out.push(cross(p, q));
      } else if (inside(q)) out.push(cross(p, q));
    }
  }
  return out;
}

/** Diagonal bands (hazard stripes) across a convex region: `n` bands of width `w` with `gap` between, kept inside `region`. */
export function hazardBands(
  region: readonly Point[],
  n: number,
  w: number,
  gap: number,
  angle = 0.7,
  origin: Point = [0, 0],
): Point[][] {
  const out: Point[][] = [];
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const nx = -dy;
  const ny = dx;
  const big = 4;
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * (w + gap);
    const cx = origin[0] + nx * off;
    const cy = origin[1] + ny * off;
    const band: Point[] = [
      pt(cx - dx * big - nx * (w / 2), cy - dy * big - ny * (w / 2)),
      pt(cx + dx * big - nx * (w / 2), cy + dy * big - ny * (w / 2)),
      pt(cx + dx * big + nx * (w / 2), cy + dy * big + ny * (w / 2)),
      pt(cx - dx * big + nx * (w / 2), cy - dy * big + ny * (w / 2)),
    ];
    const clipped = clipConvex(band, region);
    if (clipped.length >= 3) out.push(clipped);
  }
  return out;
}
