import { describe, expect, it } from 'vitest';
import { styles } from '../../data/styles';
import { clipBelow, discTriangles, ringOutline, shadowFor, signedArea } from './shape-geometry';
import { MAX_SHAPE_EXTENT, polygonArea, SHIP_KINDS, type Point } from './style';
import { buildStyles } from './style-active';

const square: Point[] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];

const xy = (tris: number[]): number[] => tris.filter((_, i) => i % 3 < 2).map(Math.abs);

describe('ringOutline', () => {
  it('makes two triangles per edge, all outside a counter-clockwise ring', () => {
    const tris = ringOutline(square, 0.2);
    expect(tris.length).toBe(4 * 2 * 3 * 3);
    for (let i = 0; i < tris.length; i += 3) {
      const r = Math.max(Math.abs(tris[i]!), Math.abs(tris[i + 1]!));
      expect(r).toBeGreaterThanOrEqual(1 - 1e-9); // never inside the shape
      expect(r).toBeLessThanOrEqual(1.2 + 1e-9);
    }
  });
  it('goes outside for a clockwise ring too, and inward for a hole', () => {
    const cw = [...square].reverse();
    expect(Math.max(...xy(ringOutline(cw, 0.2)))).toBeCloseTo(1.2);
    // A hole's stroke goes into the hole: here, inside the square.
    expect(Math.max(...xy(ringOutline(square, 0.2, false)))).toBeCloseTo(1);
  });
  it('limits the miter on sharp corners', () => {
    const spike: Point[] = [
      [0, 0],
      [10, 0.1],
      [0, 0.2],
    ];
    expect(Math.max(...ringOutline(spike, 1).map(Math.abs))).toBeLessThan(10 + 3);
  });
  it('draws nothing for width 0', () => {
    expect(ringOutline(square, 0)).toEqual([]);
  });
});

describe('shadow', () => {
  it('clips a polygon below a line', () => {
    expect(polygonArea(clipBelow(square, 0))).toBeCloseTo(2);
  });
  it('shows none at share 0, all at 1, and grows in between', () => {
    expect(shadowFor(square, 0)).toEqual([]);
    expect(polygonArea(shadowFor(square, 1))).toBeCloseTo(4);
    const a = polygonArea(shadowFor(square, 0.25));
    const b = polygonArea(shadowFor(square, 0.75));
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
  });
});

it('discTriangles makes a closed fan', () => {
  expect(discTriangles(0, 0, 1, 8).length).toBe(8 * 9);
});

describe('ship shapes of every pack (resolved) are valid', () => {
  const resolved = buildStyles(styles);
  for (const [id, r] of Object.entries(resolved)) {
    it(`${id}: every ship kind has closed, bounded shapes with area`, () => {
      for (const kind of SHIP_KINDS) {
        const def = r.pack.ships[kind];
        expect(def, `${id}.${kind}`).toBeDefined();
        const rings = [def!.polygon, def!.hole, def!.shadow, def!.eye].filter(
          (x): x is readonly Point[] => !!x,
        );
        for (const ring of rings) {
          expect(ring.length).toBeGreaterThanOrEqual(3);
          expect(ring[0]).not.toEqual(ring[ring.length - 1]); // closed implicitly
          for (const [x, y] of ring) {
            expect(Math.abs(x)).toBeLessThanOrEqual(MAX_SHAPE_EXTENT);
            expect(Math.abs(y)).toBeLessThanOrEqual(MAX_SHAPE_EXTENT);
          }
          expect(Math.abs(signedArea(ring))).toBeGreaterThan(0);
        }
      }
    });
    it(`${id}: shadow, eye and hole lie inside the silhouette bounds`, () => {
      for (const kind of SHIP_KINDS) {
        const def = r.pack.ships[kind]!;
        const xs = def.polygon.map((p) => p[0]);
        const ys = def.polygon.map((p) => p[1]);
        for (const ring of [def.shadow, def.eye, def.hole]) {
          for (const [x, y] of ring ?? []) {
            expect(x).toBeGreaterThanOrEqual(Math.min(...xs) - 1e-9);
            expect(x).toBeLessThanOrEqual(Math.max(...xs) + 1e-9);
            expect(y).toBeGreaterThanOrEqual(Math.min(...ys) - 1e-9);
            expect(y).toBeLessThanOrEqual(Math.max(...ys) + 1e-9);
          }
        }
      }
    });
  }
  it('plain reproduces today: the fighter dart, the pod ring with its core', () => {
    const plain = resolved.plain!.pack;
    expect(plain.ships.fighter!.polygon.length).toBe(10);
    expect(plain.ships.fighter!.polygon[0]).toEqual([1.3, 0]);
    expect(plain.ships.pod!.polygon.length).toBe(28);
    expect(plain.ships.pod!.hole!.length).toBe(28);
    expect(plain.ships.pod!.eye!.length).toBe(16);
    expect(plain.theme.outlineWidth).toBe(0);
    expect(plain.theme.glow).toBe(0);
    expect(plain.theme.shadowShare).toBe(0);
  });
});
