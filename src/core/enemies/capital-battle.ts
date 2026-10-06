import { TAU } from '../math';
import type { World } from '../world/world';
import { broadsideHeading, createCapital } from './capital';
import { keepInside } from './capital-ai';
import { escortHooks } from './escorts';
import type { CapitalState } from './state';

/**
 * Battle 4: the capital ship boss (spec sections 5 and 6). `spawnCapitalBattle` puts it at the arena
 * edge, `stepCapitalBattle` sends the escorts (wings on a timer, the missile fighters halfway
 * through its approach) and says when the battle is won (the core died and the death chain ended).
 * The run (`core/run/run.ts`) calls both when the battle table says `boss: 'capital'`.
 */

/**
 * Puts a fresh capital ship at (x, y) (clamped so the whole hull is inside the arena), broadside to
 * the player, replacing any capital ship on the field. Returns it. Used by the battle and the dev spawn.
 */
export function spawnCapitalAt(world: World, x: number, y: number): CapitalState {
  const cfg = world.tuning.capital;
  const ship = world.ship;
  const cap = createCapital(x, y, 0, Math.hypot(ship.x - x, ship.y - y), cfg, world.rng);
  keepInside(cap, world.tuning.flight.arenaRadius);
  cap.heading = broadsideHeading(0, Math.atan2(ship.y - cap.y, ship.x - cap.x));
  cap.startDistance = Math.hypot(ship.x - cap.x, ship.y - cap.y);
  world.enemies.capital = cap;
  world.events.emit({ type: 'EnemySpawned', kind: 'capital', x: cap.x, y: cap.y });
  return cap;
}

/** The battle's opening: the capital ship at a random point of the arena edge. */
export function spawnCapitalBattle(world: World): CapitalState {
  const cfg = world.tuning.capital;
  const angle = world.rng.range(0, TAU);
  const radius = Math.max(0, world.tuning.flight.arenaRadius - cfg.hullRadius - cfg.edgeMargin);
  return spawnCapitalAt(world, Math.cos(angle) * radius, Math.sin(angle) * radius);
}

/** How far the approach has gone, 0 at the start to 1 at the standoff distance (the ship stays at 1 from then on). */
export function approachProgress(
  cap: CapitalState,
  px: number,
  py: number,
  standoff: number,
): number {
  const span = cap.startDistance - standoff;
  if (span <= 1e-6) return 1;
  const dist = Math.hypot(px - cap.x, py - cap.y);
  return Math.min(1, Math.max(0, (cap.startDistance - dist) / span));
}

/**
 * The escorts and the objective, once per step while the battle runs. Escort wings arrive on a timer
 * (the first with the ship), the missile fighters when half the approach is done or after
 * `lancerFallbackTime`. Returns true when the capital ship is destroyed (or gone): the battle is won.
 */
export function stepCapitalBattle(world: World): boolean {
  const cap = world.enemies.capital;
  if (!cap) return true; // nothing left to fight (cleared by a dev tool)
  if (cap.phase === 2) return true;
  if (world.tuning.arena.enemiesFrozen || cap.phase !== 0) return false;
  const cfg = world.tuning.capital;
  while (cap.wingsSent < cfg.escortWings && cap.time >= cap.wingsSent * cfg.escortWingDelay) {
    escortHooks.sendWing(world, cap, cfg.escortWingSize, cap.wingsSent);
    cap.wingsSent++;
  }
  if (
    !cap.lancersSent &&
    (approachProgress(cap, world.ship.x, world.ship.y, cfg.standoff) >= 0.5 ||
      cap.time >= cfg.lancerFallbackTime)
  ) {
    cap.lancersSent = true;
    if (cfg.escortLancers > 0) escortHooks.sendLancers(world, cap, cfg.escortLancers);
  }
  return false;
}
