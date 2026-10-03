/** Player intent for one step. Produced by src/input, consumed by core systems. */
export interface Actions {
  /** Left stick / keyboard steering, each -1..1 (y is up). */
  steerX: number;
  steerY: number;
  /** -1 (brake, LT / S) .. +1 (accelerate, RT / W). */
  throttle: number;
  fire: boolean;
  evade: boolean;
}

export function createActions(): Actions {
  return { steerX: 0, steerY: 0, throttle: 0, fire: false, evade: false };
}
