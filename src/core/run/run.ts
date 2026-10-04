import type { World } from '../world/world';

/**
 * The run as a state machine (spec section 1). Issue A2 implements the transitions, battles, waves
 * objective, player hull and resupply; this contract fixes the shape every other module reads.
 * Practice mode (the Prototype 1/2 arena, the default and what the simulation tests use) is
 * `mode: 'practice'` in the `battle` phase with no battle number.
 */
export type RunMode = 'practice' | 'run';
export type RunPhase = 'start' | 'battle' | 'debrief' | 'end';
export type RunResult = 'none' | 'victory' | 'defeat';

export interface Run {
  mode: RunMode;
  phase: RunPhase;
  /** 1-based battle number while a run is on, 0 in practice mode and on the start screen. */
  battle: number;
  /** 1-based wave inside the current battle, 0 when none. */
  wave: number;
  result: RunResult;
  /** Index of the highlighted item on the current menu screen. */
  cursor: number;
}

export function createRun(): Run {
  return { mode: 'practice', phase: 'battle', battle: 0, wave: 0, result: 'none', cursor: 0 };
}

/** Runs first each step (after the button edges). No-op until issue A2. */
export function stepRun(world: World): void {
  void world;
}

const PHASES: readonly RunPhase[] = ['start', 'battle', 'debrief', 'end'];
const RESULTS: readonly RunResult[] = ['none', 'victory', 'defeat'];

/** Feeds the run state into the replay hash. Add every field you add to `Run`. */
export function mixRun(mix: (n: number) => void, run: Run): void {
  mix(run.mode === 'run' ? 1 : 0);
  mix(PHASES.indexOf(run.phase));
  mix(run.battle);
  mix(run.wave);
  mix(RESULTS.indexOf(run.result));
  mix(run.cursor);
}
