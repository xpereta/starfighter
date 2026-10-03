import type { Ship } from '../flight/flight';
import type { World } from '../world/world';

export type Formation = 'tight' | 'spread';
export type Order = 'none' | 'attack';

/** A wingman (spec section 4). Issue B2 extends this with AI state, hp handling and respawn timers. */
export interface Wingman {
  ship: Ship;
  hp: number;
  alive: boolean;
}

/**
 * The squadron: wingmen plus the current formation and order (spec sections 4 and 5).
 * Contract for lock-on and missiles: `livingWingmen()` gives the number of extra pilots.
 */
export interface Squadron {
  wingmen: Wingman[];
  formation: Formation;
  order: Order;
  /** Seconds left on the active order. */
  orderTimer: number;
}

export function createSquadron(): Squadron {
  return { wingmen: [], formation: 'tight', order: 'none', orderTimer: 0 };
}

export function livingWingmen(squadron: Squadron): number {
  let n = 0;
  for (const w of squadron.wingmen) if (w.alive) n++;
  return n;
}

/** Runs after the fighters and before lock-on each step. No-op until issues B2 and B3. */
export function stepSquadron(world: World): void {
  void world;
}

/** Feeds squadron state into the replay hash. Add every field you add to `Squadron`/`Wingman`. */
export function mixSquadron(mix: (n: number) => void, squadron: Squadron): void {
  mix(squadron.formation === 'tight' ? 0 : 1);
  mix(squadron.order === 'none' ? 0 : 1);
  mix(squadron.orderTimer);
  mix(squadron.wingmen.length);
  for (const w of squadron.wingmen) {
    mix(w.ship.x);
    mix(w.ship.y);
    mix(w.hp);
    mix(w.alive ? 1 : 0);
  }
}
