import { spawnFighter } from '../ai/waves';
import { TAU } from '../math';
import type { World } from '../world/world';
import type { CapitalState } from './state';

/**
 * The escorts of the capital ship's battle (spec section 5) as two hooks, so the battle script does
 * not depend on the other tracks. Until track A's formation wings and track B's missile fighters
 * are on this branch, both hooks send plain fighters (a V of them for a wing). When those land,
 * replace the bodies of `sendWing` and `sendLancers` (and nothing else): the script in
 * `capital-battle.ts` only calls these.
 */
export interface EscortHooks {
  /** Sends escort wing number `index` (0-based) of `size` fighters, arriving with the capital ship. */
  sendWing(world: World, cap: CapitalState, size: number, index: number): void;
  /** Sends `count` missile fighters to join the fight. */
  sendLancers(world: World, cap: CapitalState, count: number): void;
}

/** Gap between neighbours of a V (u): sideways and back. */
const WING_SPACING = 150;
const WING_SWEEP = 110;
/** Wings and lancers appear this far in front of the capital ship's hull, towards the middle of the arena (u). */
const WING_DISTANCE = 1.25;
/** Stay this share of the arena radius from the middle at most. */
const ARENA_MARGIN = 0.95;

/** Fighters in a V in front of the ship (towards the arena centre), nose towards the player. */
function spawnV(
  world: World,
  cap: CapitalState,
  size: number,
  offset: number,
  jitter: number,
): void {
  const away = Math.atan2(-cap.y, -cap.x); // from the ship to the middle of the arena
  const fx = Math.cos(away);
  const fy = Math.sin(away);
  const reach = cap.hullRadius * WING_DISTANCE + offset;
  const limit = world.tuning.flight.arenaRadius * ARENA_MARGIN;
  const mid = (size - 1) / 2;
  for (let k = 0; k < size; k++) {
    const side = (k - mid) * WING_SPACING + jitter;
    const back = Math.abs(k - mid) * WING_SWEEP;
    let x = cap.x + fx * (reach + back) - fy * side;
    let y = cap.y + fy * (reach + back) + fx * side;
    const d = Math.hypot(x, y);
    if (d > limit) {
      x *= limit / d;
      y *= limit / d;
    }
    const heading = Math.atan2(world.ship.y - y, world.ship.x - x);
    spawnFighter(world, x, y, heading, world.rng.range(0, 1));
  }
}

export const escortHooks: EscortHooks = {
  sendWing(world, cap, size, index) {
    // Successive wings arrive a little further out and to alternating sides.
    spawnV(world, cap, size, index * 250, (index % 2 === 0 ? 1 : -1) * 120 * (index > 0 ? 1 : 0));
  },
  sendLancers(world, cap, count) {
    // Stand-in: fighters from the far side of the arena, in a line across the capital ship's flank.
    const angle = Math.atan2(cap.y, cap.x) + Math.PI / 2 + world.rng.range(-0.3, 0.3);
    const radius = world.tuning.flight.arenaRadius * 0.85;
    for (let k = 0; k < count; k++) {
      const a = angle + (k - (count - 1) / 2) * 0.12;
      const x = Math.cos(a % TAU) * radius;
      const y = Math.sin(a % TAU) * radius;
      spawnFighter(
        world,
        x,
        y,
        Math.atan2(world.ship.y - y, world.ship.x - x),
        world.rng.range(0, 1),
      );
    }
  },
};
