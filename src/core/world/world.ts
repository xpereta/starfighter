import { createEventQueue, type EventQueue } from '../events/events';
import { createRng, type Rng } from '../rng/rng';

/** Shared world state. Gameplay modules read and write this plain data; no hidden state elsewhere. */
export interface World {
  readonly seed: number;
  readonly rng: Rng;
  readonly events: EventQueue;
  /** Fixed steps simulated so far. */
  tick: number;
  /** Simulated seconds (tick * dt). */
  time: number;
}

export function createWorld(seed: number): World {
  return { seed, rng: createRng(seed), events: createEventQueue(), tick: 0, time: 0 };
}

/** Advances the world by one fixed step. Gameplay systems are called from here, in a fixed order. */
export function stepWorld(world: World, dt: number): void {
  world.events.clear();
  world.tick += 1;
  world.time += dt;
}
