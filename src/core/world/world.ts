import { createEventQueue, type EventQueue } from '../events/events';
import { createRng, type Rng } from '../rng/rng';
import type { Tuning } from '../../../data/tuning';
import { createCamera, stepCamera, type Camera } from '../camera/camera';
import { createShip, stepFlight, type Ship } from '../flight/flight';
import { createActions, type Actions } from './actions';

/** Shared world state. Gameplay modules read and write this plain data; no hidden state elsewhere. */
export interface World {
  readonly seed: number;
  readonly rng: Rng;
  readonly events: EventQueue;
  /** Latest player intent; written by the input layer before each step. */
  readonly actions: Actions;
  /** Live tuning values (the dev panel edits these in place). */
  readonly tuning: Tuning;
  readonly ship: Ship;
  readonly camera: Camera;
  /** Fixed steps simulated so far. */
  tick: number;
  /** Simulated seconds (tick * dt). */
  time: number;
}

export function createWorld(seed: number, tuning: Tuning): World {
  const ship = createShip(tuning.flight);
  return {
    seed,
    rng: createRng(seed),
    events: createEventQueue(),
    actions: createActions(),
    tuning,
    ship,
    camera: createCamera(ship, tuning.flight, tuning.camera),
    tick: 0,
    time: 0,
  };
}

/** Advances the world by one fixed step. Gameplay systems are called from here, in a fixed order. */
export function stepWorld(world: World, dt: number): void {
  world.events.clear();
  world.tick += 1;
  world.time += dt;
  stepFlight(world.ship, world.actions, world.tuning.flight, dt);
  // Camera runs last so it sees this step's events (shake) and final ship state.
  stepCamera(
    world.camera,
    world.ship,
    world.tuning.flight,
    world.tuning.camera,
    world.events.events,
    world.time,
    dt,
  );
}
