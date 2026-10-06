import { describe, expect, it } from 'vitest';
import { styles } from '../../data/styles';
import { createRng } from '../core/rng/rng';
import { fracture } from './fx/fracture';
import { pointInPolygon } from './shape-parts';
import {
  checkStyle,
  SHAPE_KINDS,
  SHIP_KINDS,
  shapeTriangles,
  MAX_CAPITAL_TRIANGLES,
  MAX_SHAPE_TRIANGLES,
  polygonArea,
  type Point,
} from './style';
import { buildStyles } from './style-active';

const input = styles['used-future']!;
const pack = buildStyles(styles)['used-future']!;

/** Within `tol` of the ring (parts may touch the silhouette edge, lines may sit on it). */
function nearRing(x: number, y: number, ring: readonly Point[], tol: number): boolean {
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i]!;
    const [x2, y2] = ring[(i + 1) % ring.length]!;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy || 1)));
    if (Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy)) <= tol) return true;
  }
  return false;
}

describe('used-future', () => {
  it('passes the style checks and resolves with no warnings about invalid parts', () => {
    expect(checkStyle(input)).toEqual([]);
    expect(pack.warnings.filter((w) => w.includes('invalid'))).toEqual([]);
  });

  it('is its own look with realistic as the sound parent, and overrides only the guns', () => {
    expect(input.manifest.parent).toBe('realistic');
    expect(Object.keys(input.sounds ?? {}).sort()).toEqual([
      'EnemyShotFired',
      'ShotFired',
      'WingmanShotFired',
    ]);
    const parent = buildStyles(styles).realistic!.pack;
    expect(pack.pack.sounds.Killed).toEqual(parent.sounds.Killed);
    expect(pack.pack.sounds.ShotFired).not.toEqual(parent.sounds.ShotFired);
  });

  it('designs every ship slot and gives every slot a death sequence', () => {
    for (const k of SHAPE_KINDS) {
      expect(input.ships?.[k], `ships.${k}`).toBeDefined();
      if (k !== 'wingmanB' && k !== 'wingmanC')
        expect(input.deaths?.[k], `deaths.${k}`).toBeDefined();
    }
    for (const k of SHIP_KINDS) expect(input.ships?.[k]!.parts?.length, k).toBeGreaterThan(8);
  });

  it('every part lies on its ship: all points inside the silhouette (or on its edge)', () => {
    for (const [kind, def] of Object.entries(input.ships!)) {
      for (const [i, part] of (def.parts ?? []).entries()) {
        for (const [x, y] of part.points)
          for (const yy of part.mirror ? [y, -y] : [y]) {
            const ok = pointInPolygon(x, yy, def.polygon) || nearRing(x, yy, def.polygon, 0.06);
            expect(ok, `${kind}.parts[${i}] (${part.kind}/${part.role}) point ${x},${yy}`).toBe(
              true,
            );
          }
      }
    }
  });

  it('every ship is within its triangle budget, with real detail', () => {
    for (const [kind, def] of Object.entries(input.ships!)) {
      const cost = shapeTriangles(def);
      expect(cost, kind).toBeLessThanOrEqual(
        kind === 'capital' ? MAX_CAPITAL_TRIANGLES : MAX_SHAPE_TRIANGLES,
      );
      expect(cost, kind).toBeGreaterThan(80);
    }
  });

  it('wingman liveries keep the wingman silhouette (deaths are cut from it)', () => {
    const w = input.ships!.wingman!.polygon;
    expect(input.ships!.wingmanB!.polygon).toEqual(w);
    expect(input.ships!.wingmanC!.polygon).toEqual(w);
  });

  it('the detailed silhouettes still fracture into pieces that cover them exactly', () => {
    for (const [kind, def] of Object.entries(input.ships!)) {
      const pieces = fracture(def.polygon, 8, createRng(11));
      expect(pieces.length, kind).toBeGreaterThan(1);
      const total = pieces.reduce((s, p) => s + polygonArea(p), 0);
      expect(total, kind).toBeCloseTo(polygonArea(def.polygon), 5);
    }
  });
});
