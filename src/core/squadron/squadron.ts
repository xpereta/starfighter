import type { Ship } from '../flight/flight';
import type { Actions } from '../world/actions';
import type { World } from '../world/world';
import { stepWingmen } from './wingmen';

export type Formation = 'tight' | 'spread';
export type Order = 'none' | 'attack';

/** A wingman (spec section 4). It flies the same flight model as the player; the AI only writes `actions`. */
export interface Wingman {
  ship: Ship;
  hp: number;
  alive: boolean;
  /** AI-produced intent for the current step, fed to `stepFlight`. */
  actions: Actions;
  /** Seconds until the next shot. */
  fireCooldown: number;
  /** Lockable id of the enemy it is engaging (see core/world/lockable.ts), or -1 for none. */
  engagedId: number;
  /** Seconds until it returns after being shot down (test arena only). */
  respawnTimer: number;
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

/**
 * Wingmen: created from tuning (`wingmanCount`, also after a respawn), hold their formation slot,
 * engage enemies and can be shot down. Runs after the fighters and before lock-on each step.
 */
export function stepSquadron(world: World): void {
  stepWingmen(world);
}

/** Feeds squadron state into the replay hash. Add every field you add to `Squadron`/`Wingman`. */
export function mixSquadron(mix: (n: number) => void, squadron: Squadron): void {
  mix(squadron.formation === 'tight' ? 0 : 1);
  mix(squadron.order === 'none' ? 0 : 1);
  mix(squadron.orderTimer);
  mix(squadron.wingmen.length);
  for (const w of squadron.wingmen) {
    const s = w.ship;
    for (const v of [s.x, s.y, s.heading, s.omega, s.speed, s.vx, s.vy]) mix(v);
    for (const v of [s.evadeTimer, s.evadeCooldown, s.evadeSide, s.roll]) mix(v);
    mix(s.evadeHeld ? 1 : 0);
    mix(s.invulnerable ? 1 : 0);
    mix(w.hp);
    mix(w.alive ? 1 : 0);
    mix(w.fireCooldown);
    mix(w.engagedId);
    mix(w.respawnTimer);
  }
}
