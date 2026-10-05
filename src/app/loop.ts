/** Fixed-timestep accumulator. Pure: the caller supplies elapsed time. */
export const STEP_SECONDS = 1 / 60;
const MAX_STEPS_PER_FRAME = 5;

export interface FixedLoop {
  /** Advance by `elapsedSeconds` of wall time; returns the interpolation alpha (0..1). */
  advance(elapsedSeconds: number): number;
  /** While paused `advance` never steps and accumulates nothing, so resuming does not catch up. */
  setPaused(paused: boolean): void;
}

export function createFixedLoop(step: (dt: number) => void): FixedLoop {
  let accumulator = 0;
  let paused = false;
  return {
    setPaused(value) {
      paused = value;
    },
    advance(elapsedSeconds) {
      if (paused) return accumulator / STEP_SECONDS;
      accumulator += elapsedSeconds;
      let steps = 0;
      while (accumulator >= STEP_SECONDS && steps < MAX_STEPS_PER_FRAME) {
        step(STEP_SECONDS);
        accumulator -= STEP_SECONDS;
        steps++;
      }
      // Drop backlog after a stall (e.g. background tab) instead of spiralling.
      if (steps === MAX_STEPS_PER_FRAME) accumulator = 0;
      return accumulator / STEP_SECONDS;
    },
  };
}
