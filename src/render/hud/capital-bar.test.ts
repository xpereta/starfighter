import { describe, expect, it } from 'vitest';
import { CAPITAL_PARTS } from '../../../data/content/capital';
import { createTuning } from '../../../data/tuning';
import { coreIndex, createCapital, damagePart, killPart } from '../../core/enemies/capital';
import { createCapitalBar, fillCapitalBar } from '../../core/enemies/capital-hud';
import { createWorld } from '../../core/world/world';
import { barRects, type BarRect } from './capital-bar';

const defs = CAPITAL_PARTS;

function setup() {
  const w = createWorld(1, createTuning());
  w.enemies.capital = createCapital(0, 0, 0, 3000, w.tuning.capital, w.rng);
  return { w, cap: w.enemies.capital };
}

describe('capital health bar data', () => {
  it('has one segment per part, grouped by role, the core last and marked', () => {
    const { cap } = setup();
    const bar = fillCapitalBar(createCapitalBar(), cap);
    expect(bar.segments).toHaveLength(defs.length);
    const roles = bar.segments.map((s) => s.role);
    const firstOf = (r: string): number => roles.indexOf(r as never);
    expect(firstOf('turret')).toBeLessThan(firstOf('engine'));
    expect(firstOf('engine')).toBeLessThan(firstOf('bridge'));
    expect(firstOf('bridge')).toBeLessThan(firstOf('armour'));
    expect(roles[roles.length - 1]).toBe('core');
    expect(bar.segments.filter((s) => s.isCore)).toHaveLength(1);
    // Roles are contiguous (grouped).
    for (const r of new Set(roles)) {
      const idx = roles.map((x, i) => (x === r ? i : -1)).filter((i) => i >= 0);
      expect(idx[idx.length - 1]! - idx[0]! + 1).toBe(idx.length);
    }
  });

  it('marks the core as covered and the plates that cover it', () => {
    const { cap } = setup();
    const bar = fillCapitalBar(createCapitalBar(), cap);
    const core = bar.segments.find((s) => s.isCore)!;
    expect(core.covered).toBe(true);
    expect(bar.corePlates).toEqual({ standing: 4, total: 4 });
    const covering = bar.segments.filter((s) => s.coversCore).map((s) => s.id);
    expect(covering.sort()).toEqual(
      defs
        .filter((d) => d.covers.includes('core'))
        .map((d) => d.id)
        .sort(),
    );
    // The bow plate shields the bridge, not the core.
    expect(bar.segments.find((s) => s.id === 'plate-bow')!.coversCore).toBe(false);
    expect(bar.segments.find((s) => s.id === 'bridge')!.covered).toBe(true);
  });

  it('follows damage, destruction and exposure', () => {
    const { w, cap } = setup();
    const bar = createCapitalBar();
    const gun = defs.findIndex((d) => d.id === 'gun-mid-port');
    damagePart(w, gun, defs[gun]!.hp / 2, 0);
    fillCapitalBar(bar, cap);
    expect(bar.segments.find((s) => s.id === 'gun-mid-port')!.fraction).toBeCloseTo(0.5);
    for (let i = 0; i < defs.length; i++) if (defs[i]!.covers.includes('core')) killPart(w, i);
    fillCapitalBar(bar, cap);
    expect(bar.coreExposed).toBe(true);
    expect(bar.corePlates.standing).toBe(0);
    const core = bar.segments.find((s) => s.isCore)!;
    expect(core.covered).toBe(false);
    killPart(w, coreIndex());
    fillCapitalBar(bar, cap);
    expect(bar.segments.find((s) => s.isCore)).toMatchObject({ alive: false, fraction: 0 });
    expect(bar.phase).toBe(1);
  });

  it('reuses its segments (nothing allocated per frame)', () => {
    const { cap } = setup();
    const bar = createCapitalBar();
    fillCapitalBar(bar, cap);
    const first = bar.segments[0];
    const list = bar.segments;
    fillCapitalBar(bar, cap);
    expect(bar.segments).toBe(list);
    expect(bar.segments[0]).toBe(first);
  });
});

describe('capital health bar layout', () => {
  const { cap } = setup();
  const segments = fillCapitalBar(createCapitalBar(), cap).segments;

  it('fills exactly the width, in order, without overlap', () => {
    const rects: BarRect[] = [];
    barRects(rects, segments, 100, 500);
    expect(rects).toHaveLength(segments.length);
    expect(rects[0]!.x).toBeCloseTo(100);
    const last = rects[rects.length - 1]!;
    expect(last.x + last.width).toBeCloseTo(600);
    for (let i = 1; i < rects.length; i++) {
      expect(rects[i]!.x).toBeGreaterThan(rects[i - 1]!.x + rects[i - 1]!.width - 1e-9);
    }
  });

  it('the core is the widest segment and groups are set apart', () => {
    const rects: BarRect[] = [];
    barRects(rects, segments, 0, 500);
    const coreAt = segments.findIndex((s) => s.isCore);
    const widest = Math.max(...rects.map((r) => r.width));
    expect(rects[coreAt]!.width).toBe(widest);
    const gap = (i: number): number => rects[i]!.x - (rects[i - 1]!.x + rects[i - 1]!.width);
    const sameRole = segments.findIndex((s, i) => i > 0 && s.role === segments[i - 1]!.role);
    const roleChange = segments.findIndex((s, i) => i > 0 && s.role !== segments[i - 1]!.role);
    expect(gap(roleChange)).toBeGreaterThan(gap(sameRole));
  });

  it('survives a tiny width and reuses the rect list', () => {
    const rects: BarRect[] = [];
    barRects(rects, segments, 0, 10);
    for (const r of rects) expect(r.width).toBeGreaterThanOrEqual(0);
    const first = rects[0];
    barRects(rects, segments, 0, 500);
    expect(rects[0]).toBe(first);
  });
});
