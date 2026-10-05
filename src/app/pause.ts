import type { World } from '../core/world/world';
import { menuVisible } from '../ui/menu-model';

/** Pause is an app concern: never an action, never in the world or the replay hash. */
export interface Pause {
  readonly paused: boolean;
  /** Call once per frame with whether a pause button is held. Toggles on the press (rising edge). */
  update(held: boolean, canPause: boolean): void;
}

export function createPause(): Pause {
  let paused = false;
  let wasHeld = false;
  return {
    get paused() {
      return paused;
    },
    update(held, canPause) {
      if (held && !wasHeld && canPause) paused = !paused;
      if (!canPause) paused = false;
      wasHeld = held;
    },
  };
}

/** Practice mode and a run's battle phase; the Start/Debrief/End menus already stop the world. */
export function canPause(world: Pick<World, 'run'>): boolean {
  return !menuVisible(world.run);
}
