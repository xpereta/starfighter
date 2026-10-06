import { describe, expect, it } from 'vitest';
import { styles } from '../../data/styles';
import { createRng } from '../core/rng/rng';
import { glowMeshData, glowProfile, sphereLight } from './backdrop';
import { fracture } from './fx/fracture';
import { buildParts, partColor, pieceColor, pointInPolygon } from './shape-parts';
import {
  MAX_CAPITAL_TRIANGLES,
  MAX_PART_POINTS,
  MAX_SHAPE_PARTS,
  MAX_SHAPE_TRIANGLES,
  EXTRA_SHAPE_KINDS,
  partTriangles,
  polygonArea,
  SHAPE_KINDS,
  shapeTriangles,
  validateShips,
  validateTheme,
  type BackdropGlow,
  type Point,
  type ShapeDef,
  type ShapePart,
} from './style';
import { buildStyles } from './style-active';

const hull: Point[] = [
  [1, 0],
  [-0.8, -0.8],
  [-0.5, 0],
  [-0.8, 0.8],
];
const base: ShapeDef = { polygon: hull };
const plate: ShapePart = {
  kind: 'panel',
  role: 'panel',
  points: [
    [0.5, 0],
    [-0.1, -0.2],
    [-0.1, 0.2],
  ],
};

describe('layered ship parts: validation', () => {
  it('accepts a shape with parts, lines, mirrors and colour overrides', () => {
    const def: ShapeDef = {
      polygon: hull,
      parts: [
        plate,
        { ...plate, mirror: true, color: 0xff0000 },
        {
          kind: 'line',
          role: 'dark',
          width: 0.03,
          points: [
            [0.8, 0],
            [-0.4, 0],
          ],
        },
      ],
    };
    expect(validateShips({ player: def })).toEqual([]);
  });

  it('keeps shapes without parts valid and unchanged (parts are optional)', () => {
    expect(validateShips({ player: base })).toEqual([]);
    expect(shapeTriangles(base)).toBe(2 + 2 * 4);
  });

  it('knows the Prototype 5 shape slots and rejects other ids', () => {
    for (const k of EXTRA_SHAPE_KINDS) expect(validateShips({ [k]: base })).toEqual([]);
    expect(validateShips({ battleship: base } as never)[0]).toMatch(/not a ship kind/);
    expect(SHAPE_KINDS).toContain('gunship');
    expect(SHAPE_KINDS).toContain('lancer');
    expect(SHAPE_KINDS).toContain('capital');
  });

  it('rejects unknown kinds and roles, bad widths and colours, too few and too many points', () => {
    const bad = (part: unknown): string[] =>
      validateShips({ player: { polygon: hull, parts: [part as ShapePart] } });
    expect(bad({ ...plate, kind: 'wing' }).join()).toMatch(/kind is unknown/);
    expect(bad({ ...plate, role: 'gold' }).join()).toMatch(/role is unknown/);
    expect(bad({ ...plate, width: 0.05 }).join()).toMatch(/only for lines/);
    expect(bad({ kind: 'line', role: 'dark', points: [[0, 0]] }).join()).toMatch(/at least 2/);
    expect(
      bad({
        kind: 'line',
        role: 'dark',
        width: 1,
        points: [
          [0, 0],
          [1, 0],
        ],
      }).join(),
    ).toMatch(/width/);
    expect(bad({ ...plate, color: -1 }).join()).toMatch(/colour/);
    expect(
      bad({
        ...plate,
        points: [
          [0, 0],
          [1, 1],
        ],
      }).join(),
    ).toMatch(/at least 3/);
    expect(
      bad({
        ...plate,
        points: [
          [0, 0],
          [9, 0],
          [0, 1],
        ],
      }).join(),
    ).toMatch(/radii/);
    const many = Array.from(
      { length: MAX_PART_POINTS + 1 },
      (_, i) => [Math.cos(i), Math.sin(i)] as Point,
    );
    expect(bad({ ...plate, points: many }).join()).toMatch(/more than/);
  });

  it('validates the engine glow colour', () => {
    expect(validateShips({ player: { ...base, glowColor: 0x66aaff } })).toEqual([]);
    expect(validateShips({ player: { ...base, glowColor: 0x1000000 } }).join()).toMatch(
      /glowColor/,
    );
  });

  it('caps the number of parts', () => {
    const parts = Array.from({ length: MAX_SHAPE_PARTS + 1 }, () => plate);
    expect(validateShips({ player: { polygon: hull, parts } }).join()).toMatch(/at most/);
  });

  it('enforces the complexity budget, a bigger one for the capital ship', () => {
    const ring = (n: number): Point[] =>
      Array.from({ length: n }, (_, i) => [
        Math.cos((i / n) * 6.28) * 0.5,
        Math.sin((i / n) * 6.28) * 0.5,
      ]);
    const heavy = (n: number): ShapeDef => ({
      polygon: hull,
      parts: Array.from({ length: n }, () => ({ ...plate, points: ring(MAX_PART_POINTS) })),
    });
    // 16-point parts cost 14 triangles each (28 mirrored).
    const n = Math.ceil(MAX_SHAPE_TRIANGLES / 14);
    expect(shapeTriangles(heavy(n))).toBeGreaterThan(MAX_SHAPE_TRIANGLES);
    expect(validateShips({ fighter: heavy(n) }).join()).toMatch(/over its budget/);
    expect(validateShips({ capital: heavy(n) })).toEqual([]);
    const tooBig = Math.ceil(MAX_CAPITAL_TRIANGLES / 14) + 10;
    if (tooBig <= MAX_SHAPE_PARTS)
      expect(validateShips({ capital: heavy(tooBig) }).join()).toMatch(/budget/);
  });

  it('counts a mirrored part twice and a polyline as two triangles per segment', () => {
    expect(partTriangles(plate)).toBe(1);
    expect(partTriangles({ ...plate, mirror: true })).toBe(2);
    expect(
      partTriangles({
        kind: 'line',
        role: 'dark',
        points: [
          [0, 0],
          [1, 0],
          [1, 1],
        ],
      }),
    ).toBe(4);
  });

  it('validates the theme extensions: part colours and the backdrop', () => {
    const glow: BackdropGlow = {
      x: 0.5,
      y: 0.2,
      radius: 0.4,
      color: 0xff8800,
      strength: 0.3,
      hardness: 0,
      shade: 0,
      lightAngle: 0,
      drift: 0.02,
    };
    expect(
      validateTheme({
        partColors: { panelTone: 0.7, accent: 0xff0000 },
        backdrop: { glows: [glow], grain: { count: 100, size: 1, color: 0xffffff, opacity: 0.2 } },
      }),
    ).toEqual([]);
    expect(validateTheme({ partColors: { panelTone: 5 } }).join()).toMatch(/panelTone/);
    expect(validateTheme({ partColors: { nope: 1 } as never }).join()).toMatch(/unknown/);
    expect(validateTheme({ backdrop: { glows: [{ ...glow, hardness: 2 }] } }).join()).toMatch(
      /hardness/,
    );
    expect(
      validateTheme({ backdrop: { glows: Array.from({ length: 9 }, () => glow) } }).join(),
    ).toMatch(/at most/);
    expect(
      validateTheme({
        backdrop: { glows: [], grain: { count: 1.5, size: 1, color: 0, opacity: 0 } },
      }).join(),
    ).toMatch(/whole number/);
  });
});

describe('layered ship parts: geometry', () => {
  it('colours roles from the faction colour and the theme, with overrides winning', () => {
    const fill = 0x808080;
    const p = (role: ShapePart['role'], color?: number): ShapePart => ({ ...plate, role, color });
    expect(partColor(p('hull'), fill, undefined)).toBe(fill);
    expect(partColor(p('panel'), fill, { panelTone: 0.5 })).toBeLessThan(fill);
    expect(partColor(p('dark'), fill, { darkTone: 0 })).toBe(0);
    expect(partColor(p('accent'), fill, { accent: 0xff0000 })).toBe(0xff0000);
    expect(partColor(p('glass'), fill, { glass: 0x00ff00 })).toBe(0x00ff00);
    expect(partColor(p('glow'), fill, { glow: 0x0000ff })).toBe(0x0000ff);
    expect(partColor(p('accent', 0x123456), fill, { accent: 0xff0000 })).toBe(0x123456);
  });

  it('builds the triangles it budgets, mirrors, orders parts by depth and splits lights', () => {
    const def: ShapeDef = {
      polygon: hull,
      parts: [
        plate,
        { ...plate, mirror: true, role: 'accent' },
        { ...plate, role: 'glow' },
        {
          kind: 'line',
          role: 'dark',
          points: [
            [0, 0],
            [0.5, 0],
          ],
        },
      ],
    };
    const { body, lights } = buildParts(def, 0xffffff, undefined, 0.02, 0.03);
    // body: plate (1) + mirrored plate (2) + line (2) triangles; lights: one glow plate.
    expect(body.positions.length / 9).toBe(1 + 2 + 2);
    expect(lights.positions.length / 9).toBe(1);
    expect(body.colors.length).toBe(body.positions.length);
    const zs = (t: number[]): number[] => t.filter((_, i) => i % 3 === 2);
    // The mirrored copy is below the axis too, and a later part sits over an earlier one.
    const ys = body.positions.filter((_, i) => i % 3 === 1);
    expect(Math.min(...ys)).toBeLessThan(0);
    expect(Math.max(...zs(body.positions))).toBeGreaterThan(Math.min(...zs(body.positions)));
    expect(Math.min(...zs(lights.positions))).toBeGreaterThanOrEqual(0.03);
  });

  it('every triangle of a part stays on the part (no stray vertices)', () => {
    const { body } = buildParts({ polygon: hull, parts: [plate] }, 0xffffff, undefined, 0.02, 0.03);
    for (let i = 0; i < body.positions.length; i += 3) {
      expect(
        pointInPolygon(body.positions[i]! * 0.999, body.positions[i + 1]! * 0.999, plate.points) ||
          plate.points.some((p) => p[0] === body.positions[i] && p[1] === body.positions[i + 1]),
      ).toBe(true);
    }
  });

  it('colours wreckage pieces by the top part under their centre; lines and lights do not count', () => {
    const def: ShapeDef = {
      polygon: hull,
      parts: [
        { ...plate, role: 'accent' },
        {
          kind: 'line',
          role: 'dark',
          points: [
            [0.5, 0],
            [0, 0],
          ],
        },
        {
          ...plate,
          role: 'glow',
          points: [
            [0.5, 0],
            [0.3, 0.1],
            [0.3, -0.1],
          ],
        },
      ],
    };
    const colors = { accent: 0xff0000 };
    expect(pieceColor(def, 0.2, 0, 0x808080, colors)).toBe(0xff0000);
    expect(pieceColor(def, -0.7, 0.6, 0x808080, colors)).toBe(0x808080);
    expect(pieceColor(base, 0.2, 0, 0x808080, colors)).toBe(0x808080);
    const mirrored: ShapeDef = {
      polygon: hull,
      parts: [{ ...plate, mirror: true, role: 'accent' }],
    };
    expect(pieceColor(mirrored, 0.2, 0.05, 0x808080, colors)).toBe(0xff0000);
  });

  it('death fracture follows the outer silhouette only and covers it exactly, whatever the parts', () => {
    const def: ShapeDef = { polygon: hull, parts: [plate, { ...plate, mirror: true }] };
    const pieces = fracture(def.polygon, 6, createRng(5));
    expect(pieces.length).toBeGreaterThan(1);
    const total = pieces.reduce((s, p) => s + polygonArea(p), 0);
    expect(total).toBeCloseTo(polygonArea(def.polygon), 6);
  });
});

describe('backdrop glows', () => {
  const glow: BackdropGlow = {
    x: 0,
    y: 0,
    radius: 0.3,
    color: 0xffffff,
    strength: 0.5,
    hardness: 0.9,
    shade: 0.8,
    lightAngle: 45,
    drift: 0,
  };
  it('falls off from the centre to nothing at the rim, solid up to its hardness', () => {
    expect(glowProfile(0, 0)).toBe(1);
    expect(glowProfile(1, 0)).toBe(0);
    expect(glowProfile(0.5, 0.9)).toBe(1);
    expect(glowProfile(0.95, 0.9)).toBeGreaterThan(0);
    expect(glowProfile(0.95, 0.9)).toBeLessThan(1);
  });
  it('lights the side facing the light', () => {
    expect(sphereLight(0.7, 0.7, 45, 1)).toBeGreaterThan(sphereLight(-0.7, -0.7, 45, 1));
    expect(sphereLight(-0.7, -0.7, 45, 0)).toBe(1);
  });
  it('makes an indexed disc with RGBA vertices, every index in range', () => {
    const d = glowMeshData(glow);
    const vertices = d.positions.length / 3;
    expect(d.colors.length / 4).toBe(vertices);
    expect(Math.max(...d.index)).toBeLessThan(vertices);
    expect(d.index.length % 3).toBe(0);
    expect(d.colors[3]).toBeCloseTo(0.5); // centre opacity = strength
    expect(d.colors[d.colors.length - 1]).toBeCloseTo(0); // rim fades out
  });
});

describe('every resolved pack: shapes are valid and within budget, parts stay on the ship', () => {
  for (const [id, r] of Object.entries(buildStyles(styles))) {
    it(`${id}: every shape has at most its triangle budget and its parts lie within the hull's bounds (a glow may stick out a hair)`, () => {
      for (const [kind, def] of Object.entries(r.pack.ships)) {
        const budget = kind === 'capital' ? MAX_CAPITAL_TRIANGLES : MAX_SHAPE_TRIANGLES;
        expect(shapeTriangles(def), `${id}.${kind}`).toBeLessThanOrEqual(budget);
        const xs = def.polygon.map((p) => p[0]);
        const ys = def.polygon.map((p) => p[1]);
        for (const part of def.parts ?? []) {
          for (const [x, y] of part.points) {
            expect(x).toBeGreaterThanOrEqual(Math.min(...xs) - 0.06);
            expect(x).toBeLessThanOrEqual(Math.max(...xs) + 0.06);
            // A mirrored part is checked on its mirrored side too.
            const ymax = Math.max(...ys);
            const ymin = Math.min(...ys);
            expect(y).toBeLessThanOrEqual(ymax + 0.06);
            expect(y).toBeGreaterThanOrEqual(ymin - 0.06);
          }
        }
      }
    });
  }
});
