import * as THREE from 'three';
import {
  DEFAULT_PART_COLORS,
  type PartColors,
  type PartRole,
  type Point,
  type ShapeDef,
  type ShapePart,
} from './style';

/** Layer step between two parts: later parts draw over earlier ones. 96 parts fit between the hull fill and the shadow. */
export const PART_Z_STEP = 0.00008;
/** Default width of a `line` part, radius units. */
export const DEFAULT_LINE_WIDTH = 0.02;

/** Roles drawn above the hard shadow (lights do not sit in shade). */
export const isLightRole = (role: PartRole): boolean => role === 'glass' || role === 'glow';

const tmpColor = new THREE.Color();

/** The 0xRRGGBB colour of a part: its own override, else its role applied to the ship's faction colour. */
export function partColor(
  part: ShapePart,
  fill: number,
  colors: Partial<PartColors> | undefined,
): number {
  if (part.color !== undefined) return part.color;
  const c = { ...DEFAULT_PART_COLORS, ...colors };
  switch (part.role) {
    case 'hull':
      return fill;
    case 'panel':
      return tmpColor.setHex(fill).multiplyScalar(c.panelTone).getHex();
    case 'dark':
      return tmpColor.setHex(fill).multiplyScalar(c.darkTone).getHex();
    case 'accent':
      return c.accent;
    case 'glass':
      return c.glass;
    case 'glow':
      return c.glow;
  }
}

/** Flat triangle data of some parts: x, y, z triples and one linear-RGB triple per vertex. */
export interface PartTriangles {
  positions: number[];
  colors: number[];
}

const mirrorOf = (p: readonly Point[]): Point[] => p.map(([x, y]) => [x, -y] as Point);

/** Triangles of a polygon (any winding, simple outline), appended to `out` at depth `z`. */
function addPolygon(out: PartTriangles, points: readonly Point[], z: number, rgb: number[]): void {
  const contour = points.map(([x, y]) => new THREE.Vector2(x, y));
  const faces = THREE.ShapeUtils.triangulateShape(contour, []);
  for (const f of faces)
    for (const i of f) {
      const [x, y] = points[i]!;
      out.positions.push(x, y, z);
      out.colors.push(rgb[0]!, rgb[1]!, rgb[2]!);
    }
}

/** A polyline as one quad per segment, each lengthened by half the width at both ends so corners close. */
function addLine(
  out: PartTriangles,
  points: readonly Point[],
  width: number,
  z: number,
  rgb: number[],
): void {
  const h = width / 2;
  for (let i = 0; i + 1 < points.length; i++) {
    const [x1, y1] = points[i]!;
    const [x2, y2] = points[i + 1]!;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) continue;
    const ux = dx / len;
    const uy = dy / len;
    const ax = x1 - ux * h;
    const ay = y1 - uy * h;
    const bx = x2 + ux * h;
    const by = y2 + uy * h;
    const nx = -uy * h;
    const ny = ux * h;
    const quad = [
      [ax + nx, ay + ny],
      [bx + nx, by + ny],
      [bx - nx, by - ny],
      [ax - nx, ay - ny],
    ] as const;
    for (const k of [0, 1, 2, 0, 2, 3]) {
      out.positions.push(quad[k]![0], quad[k]![1], z);
      out.colors.push(rgb[0]!, rgb[1]!, rgb[2]!);
    }
  }
}

/**
 * Builds the layered parts of a shape as triangles with vertex colours. Parts keep their
 * authored order as depth; roles `glass` and `glow` go to `lights` (drawn above the hard shadow),
 * the rest to `body`. Mirrored parts are emitted twice. Done once per build, never per frame.
 */
export function buildParts(
  def: ShapeDef,
  fill: number,
  colors: Partial<PartColors> | undefined,
  zBody: number,
  zLights: number,
): { body: PartTriangles; lights: PartTriangles } {
  const body: PartTriangles = { positions: [], colors: [] };
  const lights: PartTriangles = { positions: [], colors: [] };
  const rgb = [0, 0, 0];
  (def.parts ?? []).forEach((part, i) => {
    const target = isLightRole(part.role) ? lights : body;
    const z = (isLightRole(part.role) ? zLights : zBody) + i * PART_Z_STEP;
    tmpColor.setHex(partColor(part, fill, colors));
    rgb[0] = tmpColor.r;
    rgb[1] = tmpColor.g;
    rgb[2] = tmpColor.b;
    const draw = (pts: readonly Point[]): void => {
      if (part.kind === 'line') addLine(target, pts, part.width ?? DEFAULT_LINE_WIDTH, z, rgb);
      else addPolygon(target, pts, z, rgb);
    };
    draw(part.points);
    if (part.mirror) draw(mirrorOf(part.points));
  });
  return { body, lights };
}

/** True when (x, y) is inside the polygon (even-odd rule). */
export function pointInPolygon(x: number, y: number, p: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i]!;
    const [xj, yj] = p[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * The colour of the wreckage piece whose centre sits at (x, y) in the ship's own frame: the top
 * filled, non-light part under that point, else the hull fill. Pieces are cut along the outer
 * silhouette; parts only decide their colour.
 */
export function pieceColor(
  def: ShapeDef,
  x: number,
  y: number,
  fill: number,
  colors: Partial<PartColors> | undefined,
): number {
  const parts = def.parts;
  if (!parts) return fill;
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i]!;
    if (part.kind === 'line' || isLightRole(part.role)) continue;
    if (pointInPolygon(x, y, part.points) || (part.mirror && pointInPolygon(x, -y, part.points)))
      return partColor(part, fill, colors);
  }
  return fill;
}
