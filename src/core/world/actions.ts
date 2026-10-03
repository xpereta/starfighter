/** Player intent for one step. Produced by src/input, consumed by core systems. */
export interface Actions {
  /** Left stick vector, each -1..1 (y is up). */
  steerX: number;
  steerY: number;
  /** Keyboard rotate, -1..1 (positive = turn right). Works in both steering schemes. */
  rotate: number;
  /** -1 (brake, LT / S) .. +1 (accelerate, RT / W). */
  throttle: number;
  fire: boolean;
  evade: boolean;
  /** Reset the arena and ship (edge-triggered by the world). */
  respawn: boolean;
  /** Start the time trial (edge-triggered by the world). */
  startTrial: boolean;
  /** Launch the missile salvo at the locked targets (edge-triggered by the weapons module). */
  launch: boolean;
  /** Order: wingmen attack my target (edge-triggered). */
  attackOrder: boolean;
  /** Order: cycle the formation tight <-> spread (edge-triggered). */
  cycleFormation: boolean;
}

export function createActions(): Actions {
  return {
    steerX: 0,
    steerY: 0,
    rotate: 0,
    throttle: 0,
    fire: false,
    evade: false,
    respawn: false,
    startTrial: false,
    launch: false,
    attackOrder: false,
    cycleFormation: false,
  };
}
