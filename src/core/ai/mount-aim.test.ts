import { describe, expect, it } from 'vitest';
import { ENEMY_KINDS } from '../../../data/content/enemies';
import { DEG } from '../math';
import { clampToArc, createMountState, inArc, slewAngle, stepBurst } from './mount-aim';

const DT = 1 / 60;

describe('firing arcs', () => {
  it('inArc is true inside the arc, false outside, and works across the +-pi seam', () => {
    expect(inArc(0, 0, 10 * DEG)).toBe(true);
    expect(inArc(9 * DEG, 0, 10 * DEG)).toBe(true);
    expect(inArc(11 * DEG, 0, 10 * DEG)).toBe(false);
    expect(inArc(179 * DEG, Math.PI, 5 * DEG)).toBe(true);
    expect(inArc(-179 * DEG, Math.PI, 5 * DEG)).toBe(true);
    expect(inArc(170 * DEG, Math.PI, 5 * DEG)).toBe(false);
  });

  it('an arc of pi covers every direction', () => {
    for (let a = -Math.PI; a <= Math.PI; a += 0.3) expect(inArc(a, 1.2, Math.PI)).toBe(true);
  });

  it('clampToArc keeps an angle that is inside and moves an outside one to the nearer edge', () => {
    expect(clampToArc(0.2, 0, 0.5)).toBeCloseTo(0.2);
    expect(clampToArc(2, 0, 0.5)).toBeCloseTo(0.5);
    expect(clampToArc(-2, 0, 0.5)).toBeCloseTo(-0.5);
    // Behind a mount that looks sideways: the closer edge, going the short way round.
    expect(clampToArc(Math.PI, Math.PI / 2, 0.5)).toBeCloseTo(Math.PI / 2 + 0.5);
    expect(clampToArc(-Math.PI + 0.01, -Math.PI / 2, 0.5)).toBeCloseTo(-Math.PI / 2 - 0.5);
  });

  it('the two default gunship arcs leave a blind wedge only straight behind', () => {
    const [left, right] = ENEMY_KINDS.gunship.mounts;
    const covered = (a: number): boolean =>
      inArc(a, left!.arcCenter, left!.arcHalf) || inArc(a, right!.arcCenter, right!.arcHalf);
    expect(covered(0)).toBe(true); // flying straight at it is covered by both
    expect(covered(Math.PI / 2)).toBe(true);
    expect(covered(-Math.PI / 2)).toBe(true);
    expect(covered(Math.PI)).toBe(false); // the blind spot
    expect(covered(Math.PI - 10 * DEG)).toBe(false);
    expect(covered(Math.PI - 30 * DEG)).toBe(true);
  });
});

describe('slewing an aim', () => {
  it('moves at most maxStep towards the target, the short way round', () => {
    expect(slewAngle(0, 1, 0.1)).toBeCloseTo(0.1);
    expect(slewAngle(0, -1, 0.1)).toBeCloseTo(-0.1);
    expect(slewAngle(3, -3, 0.1)).toBeCloseTo(3.1);
  });

  it('lands exactly on the target when it is within a step', () => {
    expect(slewAngle(0.05, 0.08, 0.1)).toBeCloseTo(0.08);
  });
});

describe('burst windows', () => {
  const mount = {
    id: 't',
    x: 0,
    y: 0,
    arcCenter: 0,
    arcHalf: 1,
    fireRate: 12,
    bulletSpeed: 700,
    bulletDamage: 1,
    bulletLife: 1,
    range: 800,
    spread: 0,
    burst: { shots: 6, pause: 1 },
  };

  /** Steps `seconds` with the target always there; returns the times of the shots. */
  function run(seconds: number, wantFire = true): number[] {
    const state = createMountState(mount);
    const times: number[] = [];
    for (let i = 0; i < Math.round(seconds / DT); i++) {
      if (stepBurst(state, mount.burst, mount.fireRate, DT, wantFire)) times.push(i * DT);
    }
    return times;
  }

  it('fires bursts of `shots` at the fire rate, then pauses', () => {
    const times = run(3);
    // Burst 1: six shots in about 0.42 s, then a 1 s window with no fire, then burst 2.
    expect(times.slice(0, 6).every((t) => t < 0.5)).toBe(true);
    const gap = times[6]! - times[5]!;
    expect(gap).toBeGreaterThanOrEqual(1 - DT);
    expect(gap).toBeLessThan(1 + 2 * DT);
  });

  it('holds the long-run rate: burst shots per (burst time + pause)', () => {
    const times = run(20);
    const perCycle = 6 / (6 / 12 + 1);
    expect(times.length / 20).toBeGreaterThan(perCycle * 0.9);
    expect(times.length / 20).toBeLessThan(perCycle * 1.1);
  });

  it('does not fire without a target and does not lose its burst', () => {
    expect(run(2, false)).toEqual([]);
  });

  it('shots 1 means a steady stream with no pause', () => {
    const steady = { ...mount, burst: { shots: 1, pause: 5 } };
    const state = createMountState(steady);
    let shots = 0;
    for (let i = 0; i < 120; i++) if (stepBurst(state, steady.burst, 12, DT, true)) shots++;
    expect(shots).toBeGreaterThanOrEqual(23);
    expect(shots).toBeLessThanOrEqual(25);
  });
});
