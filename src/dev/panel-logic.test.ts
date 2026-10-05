import { describe, expect, it } from 'vitest';
import { qualityParams } from '../../data/quality';
import { createTuning, tuningParams } from '../../data/tuning';
import type { ParamDef } from '../core/params/params';
import {
  clampToRelations,
  decimalsOf,
  formatValue,
  fractionOf,
  isChanged,
  labelOf,
  RELATIONS,
  roundTyped,
  snapToStep,
  stepOf,
  valueAtFraction,
} from './panel-logic';

const def = (over: Partial<ParamDef> = {}): ParamDef => ({
  default: 2,
  min: 0.5,
  max: 5,
  unit: 's',
  ...over,
});

const allDefs = (): [string, ParamDef][] => [
  ...Object.entries(tuningParams).flatMap(([g, defs]) =>
    Object.entries(defs).map(([k, d]): [string, ParamDef] => [`${g}.${k}`, d]),
  ),
  ...Object.entries(qualityParams).map(([k, d]): [string, ParamDef] => [`quality.${k}`, d]),
];

describe('labelOf', () => {
  it('turns camelCase keys into short readable labels', () => {
    expect(labelOf('evadeCooldown')).toBe('Evade cooldown');
    expect(labelOf('gripAtMaxSpeed')).toBe('Grip at max speed');
    expect(labelOf('steering')).toBe('Steering');
    expect(labelOf('evadeIFrames')).toBe('Evade i-frames');
  });
});

describe('steps and decimals', () => {
  it('uses about 100 notches over the range, as 1/2/5 steps', () => {
    expect(stepOf(def({ min: 0, max: 1, default: 0.5 }))).toBe(0.01);
    expect(stepOf(def({ min: 800, max: 3000, default: 1600 }))).toBe(20);
    expect(stepOf(def({ min: 1000, max: 7800, default: 2600 }))).toBe(50);
    expect(stepOf(def({ step: 0.25 }))).toBe(0.25);
  });

  it('uses whole numbers for whole-number parameters', () => {
    expect(stepOf(def({ min: 0, max: 20, default: 3 }))).toBe(1);
    expect(stepOf(def({ min: 0, max: 100, default: 20 }))).toBe(1);
  });

  it('derives the displayed decimals from the step', () => {
    expect(decimalsOf(1)).toBe(0);
    expect(decimalsOf(20)).toBe(0);
    expect(decimalsOf(0.05)).toBe(2);
    expect(decimalsOf(0.001)).toBe(3);
    expect(decimalsOf(1e-7)).toBe(7);
  });

  it('every shipped default is shown exactly, with no rounding noise', () => {
    for (const [name, d] of allDefs()) {
      expect(Number(formatValue(d.default, d).number), name).toBe(d.default);
    }
  });

  it('formats with fixed decimals and the short unit', () => {
    expect(formatValue(2, def())).toEqual({ number: '2.00', unit: 's' });
    expect(formatValue(5.0400001, def({ min: 0.5, max: 8, default: 2 }))).toMatchObject({
      number: '5.04',
    });
  });
});

describe('rounding', () => {
  it('snaps dragged values to the grid with no float noise, inside the range', () => {
    const d = def({ min: 0.5, max: 8, default: 2 });
    const step = stepOf(d);
    for (let v = -1; v < 10; v += 0.0731) {
      const s = snapToStep(v, d);
      expect(s).toBeGreaterThanOrEqual(d.min);
      expect(s).toBeLessThanOrEqual(d.max);
      expect(Number(s.toFixed(decimalsOf(step)))).toBe(s); // no 5.0400000001-style noise
    }
  });

  it('typed values are rounded to the shown decimals and clamped, not snapped to the grid', () => {
    const d = def({ min: 0, max: 1, default: 0.5 }); // 2 decimals
    expect(roundTyped(0.456, d)).toBe(0.46);
    expect(roundTyped(7, d)).toBe(1);
    expect(roundTyped(-3, d)).toBe(0);
    expect(roundTyped(700, def({ min: 0, max: 20000, default: 700 }))).toBe(700);
  });

  it('maps pointer fractions onto the range ends', () => {
    const d = def({ min: 800, max: 3000, default: 1600 });
    expect(valueAtFraction(0, d)).toBe(800);
    expect(valueAtFraction(1, d)).toBe(3000);
    expect(valueAtFraction(-1, d)).toBe(800);
    expect(valueAtFraction(2, d)).toBe(3000);
    expect(fractionOf(1900, d)).toBeCloseTo(0.5);
  });
});

describe('cross-field relations', () => {
  const flight = () => ({ ...createTuning().flight }) as unknown as Record<string, unknown>;

  it('keeps minSpeed <= cornerSpeed <= maxSpeed and minSpeed <= cruiseSpeed <= maxSpeed', () => {
    const f = flight();
    expect(clampToRelations('flight', 'minSpeed', 999, f)).toBe(f.cornerSpeed); // also below cruise: min wins the lowest bound
    expect(clampToRelations('flight', 'cornerSpeed', 10, f)).toBe(f.minSpeed);
    expect(clampToRelations('flight', 'cornerSpeed', 9999, f)).toBe(f.maxSpeed);
    expect(clampToRelations('flight', 'cruiseSpeed', 9999, f)).toBe(f.maxSpeed);
    expect(clampToRelations('flight', 'cruiseSpeed', 0, f)).toBe(f.minSpeed);
    expect(clampToRelations('flight', 'maxSpeed', 0, f)).toBe(
      Math.max(f.cornerSpeed as number, f.cruiseSpeed as number),
    );
  });

  it('keeps viewMax >= viewMin', () => {
    const cam = createTuning().camera as unknown as Record<string, unknown>;
    expect(clampToRelations('camera', 'viewMax', 100, cam)).toBe(cam.viewMin);
    expect(clampToRelations('camera', 'viewMin', 99999, cam)).toBe(cam.viewMax);
    expect(clampToRelations('camera', 'viewMax', 5000, cam)).toBe(5000);
  });

  it('lancer rangeMax cannot go below rangeMin and back', () => {
    const l = { rangeMin: 900, rangeMax: 1500 };
    expect(clampToRelations('lancer', 'rangeMax', 500, l)).toBe(900);
    expect(clampToRelations('lancer', 'rangeMin', 3000, l)).toBe(1500);
  });

  it('leaves unrelated keys and other groups alone', () => {
    const f = flight();
    expect(clampToRelations('flight', 'grip', 99, f)).toBe(99);
    expect(clampToRelations('weapons', 'minSpeed', 99, f)).toBe(99);
  });

  it('shipped defaults satisfy every relation', () => {
    const t = createTuning() as unknown as Record<string, Record<string, number>>;
    for (const r of RELATIONS) {
      expect(t[r.group]![r.lo]!, `${r.group}.${r.lo} <= ${r.hi}`).toBeLessThanOrEqual(
        t[r.group]![r.hi]!,
      );
    }
  });

  it('viewMax can reach three times its default', () => {
    // Xavi asked for 3x the original 2600 u default; the default itself has since been tuned.
    expect(tuningParams.camera.viewMax.max).toBe(7800);
    expect(tuningParams.camera.viewMax.default).toBeLessThanOrEqual(7800);
  });
});

describe('changed detection and reset', () => {
  it('flags values that differ from the default, and reset makes them equal again', () => {
    const t = createTuning();
    const d = tuningParams.flight.grip;
    expect(isChanged(t.flight.grip, d.default)).toBe(false);
    t.flight.grip = 9;
    expect(isChanged(t.flight.grip, d.default)).toBe(true);
    t.flight.grip = d.default; // what double-clicking the label does
    expect(isChanged(t.flight.grip, d.default)).toBe(false);
    expect(isChanged('rotate', 'point')).toBe(true);
    expect(isChanged(true, true)).toBe(false);
  });
});
