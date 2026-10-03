/** Fixed-timestep accumulator. Pure: the caller supplies elapsed time. */
export const STEP_SECONDS = 1 / 60;
const MAX_STEPS_PER_FRAME = 5;

export interface FixedLoop {
  /** Advance by `elapsedSeconds` of wall time; returns the interpolation alpha (0..1). */
  advance(elapsedSeconds: number): number;
}

export function createFixedLoop(step: (dt: number) => void): FixedLoop {
  let accumulator = 0;
  return {
    advance(elapsedSeconds) {
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
