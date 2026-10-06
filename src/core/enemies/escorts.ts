import { spawnLancer } from '../ai/lancer';
import { spawnWing } from '../ai/wings';
import { TAU } from '../math';
import type { World } from '../world/world';
import type { CapitalState } from './state';

/**
 * The escorts of the capital ship's battle (spec section 5) as two hooks the battle script calls
 * (`capital-battle.ts`): `sendWing` brings in a real formation wing (track A's `spawnWing`, so it
 * flies in formation, breaks on fire or proximity and shows WING INBOUND) and `sendLancers` real
 * missile fighters (track B's `spawnLancer`).
 */
export interface EscortHooks {
  /** Sends escort wing number `index` (0-based) of `size` fighters, arriving with the capital ship. */
  sendWing(world: World, cap: CapitalState, size: number, index: number): void;
  /** Sends `count` missile fighters to join the fight. */
  sendLancers(world: World, cap: CapitalState, count: number): void;
}

/** Wings and lancers appear this far in front of the capital ship's hull, towards the middle of the arena (hull radii). */
const WING_DISTANCE = 1.25;
/** Stay this share of the arena radius from the middle at most. */
const ARENA_MARGIN = 0.95;
/** Successive wings arrive this much further out (u) and to alternating sides (u). */
const WING_STEP = 250;
const WING_SIDE = 120;

export const escortHooks: EscortHooks = {
  sendWing(world, cap, size, index) {
    const away = Math.atan2(-cap.y, -cap.x); // from the ship to the middle of the arena
    const fx = Math.cos(away);
    const fy = Math.sin(away);
    const reach = cap.hullRadius * WING_DISTANCE + index * WING_STEP;
    const side = (index % 2 === 0 ? 1 : -1) * WING_SIDE * (index > 0 ? 1 : 0);
    let x = cap.x + fx * reach - fy * side;
    let y = cap.y + fy * reach + fx * side;
    const limit = world.tuning.flight.arenaRadius * ARENA_MARGIN;
    const d = Math.hypot(x, y);
    if (d > limit) {
      x *= limit / d;
      y *= limit / d;
    }
    spawnWing(world, x, y, Math.atan2(world.ship.y - y, world.ship.x - x), size);
  },
  sendLancers(world, cap, count) {
    // From the far side of the arena, in a line across the capital ship's flank.
    const angle = Math.atan2(cap.y, cap.x) + Math.PI / 2 + world.rng.range(-0.3, 0.3);
    const radius = world.tuning.flight.arenaRadius * 0.85;
    for (let k = 0; k < count; k++) {
      const a = angle + (k - (count - 1) / 2) * 0.12;
      const x = Math.cos(a % TAU) * radius;
      const y = Math.sin(a % TAU) * radius;
      spawnLancer(world, x, y, Math.atan2(world.ship.y - y, world.ship.x - x));
    }
  },
};
