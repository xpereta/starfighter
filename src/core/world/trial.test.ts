import { describe, expect, it } from 'vitest';
import { createArenaConfig } from '../../../data/tuning/arena';
import { createRng } from '../rng/rng';
import { createTargets } from './arena';
import { createTrial, startTrial, stepTrial } from './trial';

const DT = 1 / 60;
const targets = () => createTargets(createArenaConfig(), createRng(1));
const drones = (t: ReturnType<typeof targets>) => t.filter((x) => x.kind === 'drone');

describe('time trial', () => {
  it('does not run the clock until started', () => {
    const trial = createTrial();
    stepTrial(trial, targets(), 5);
    expect(trial.time).toBe(0);
  });

  it('start revives all drones and resets the clock', () => {
    const t = targets();
    drones(t).forEach((d) => (d.alive = false));
    const trial = createTrial();
    startTrial(trial, t);
    expect(drones(t).every((d) => d.alive && d.hp === d.maxHp)).toBe(true);
    expect(trial.active).toBe(true);
    expect(trial.time).toBe(0);
  });

  it('completes when all drones are down and records last/best', () => {
    const t = targets();
    const trial = createTrial();
    startTrial(trial, t);
    for (let i = 0; i < 120; i++) stepTrial(trial, t, DT);
    drones(t).forEach((d) => (d.alive = false));
    expect(stepTrial(trial, t, DT)).toBe(true);
    expect(trial.active).toBe(false);
    expect(trial.last).toBeCloseTo(121 * DT);
    expect(trial.best).toBeCloseTo(121 * DT);
    const time = trial.time;
    stepTrial(trial, t, DT);
    expect(trial.time).toBe(time); // clock stopped
  });

  it('keeps the best time when a later run is slower, and takes a faster one', () => {
    const t = targets();
    const trial = createTrial(30);
    startTrial(trial, t);
    for (let i = 0; i < 60 * 40; i++) stepTrial(trial, t, DT);
    drones(t).forEach((d) => (d.alive = false));
    stepTrial(trial, t, DT);
    expect(trial.best).toBe(30);
    expect(trial.last).toBeGreaterThan(30);
    startTrial(trial, t);
    for (let i = 0; i < 60 * 10; i++) stepTrial(trial, t, DT);
    drones(t).forEach((d) => (d.alive = false));
    stepTrial(trial, t, DT);
    expect(trial.best).toBeCloseTo(10, 1);
  });
});
