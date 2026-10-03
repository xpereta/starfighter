import type { Target } from './target';
import { reviveTarget } from './arena';

/** Time trial: destroy every moving drone as fast as possible. */
export interface Trial {
  active: boolean;
  /** Seconds since the trial started. */
  time: number;
  /** Time of the last completed run, or null. */
  last: number | null;
  /** Best completed time, or null. Persisted by the app (see src/app/save.ts). */
  best: number | null;
}

export function createTrial(best: number | null = null): Trial {
  return { active: false, time: 0, last: null, best };
}

/** Revives every drone and starts the clock. */
export function startTrial(trial: Trial, targets: readonly Target[]): void {
  for (const t of targets) if (t.kind === 'drone') reviveTarget(t);
  trial.active = true;
  trial.time = 0;
}

/** Advances the clock; completes the run once every drone is down. Returns true on completion. */
export function stepTrial(trial: Trial, targets: readonly Target[], dt: number): boolean {
  if (!trial.active) return false;
  trial.time += dt;
  let drones = 0;
  for (const t of targets) {
    if (t.kind !== 'drone') continue;
    if (t.alive) return false;
    drones++;
  }
  if (drones === 0) return false;
  trial.active = false;
  trial.last = trial.time;
  trial.best = trial.best === null ? trial.time : Math.min(trial.best, trial.time);
  return true;
}
