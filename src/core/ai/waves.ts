import type { FlightConfig } from '../../../data/tuning/flight';
import { TAU } from '../math';
import { FIGHTER_ID_BASE } from '../world/lockable';
import type { World } from '../world/world';
import { createFighter, NO_HIT } from './fighter';
import { deriveFlight } from './steering';

/** Marks fighters at 0 hp as destroyed and emits `Killed`. Returns how many died. */
export function resolveFighterKills(world: World): number {
  let kills = 0;
  world.fighters.forEach((f, i) => {
    if (!f.alive || f.hp > 0) return;
    f.alive = false;
    f.immune = false;
    f.diedAt = world.time;
    kills++;
    world.events.emit({
      type: 'Killed',
      entityId: FIGHTER_ID_BASE + i,
      kind: 'fighter',
      x: f.x,
      y: f.y,
      radius: f.radius,
    });
  });
  world.stats.kills += kills;
  return kills;
}

/**
 * Adds one fighter at a position, flying along `heading`. A dead slot in `world.fighters` is reused
 * first (so the array stays small and ids stay stable), otherwise the array grows. Returns its index.
 */
export function spawnFighter(
  world: World,
  x: number,
  y: number,
  heading: number,
  retargetTimer = 0,
): number {
  const cfg = world.tuning.fighter;
  const flight = deriveFlight({} as FlightConfig, world.tuning.flight, cfg);
  const fighter = createFighter(flight, x, y, heading, cfg.health, cfg.radius, retargetTimer);
  const dead = world.fighters.findIndex((f) => !f.alive);
  if (dead >= 0) {
    world.fighters[dead] = fighter;
    return dead;
  }
  world.fighters.push(fighter);
  return world.fighters.length - 1;
}

/** Brings in a wave: `size` fighters (practice: `waveSize`) spread around the arena edge, heading roughly inward. */
export function spawnWave(world: World, size = world.tuning.fighter.waveSize): void {
  const cfg = world.tuning.fighter;
  const radius = world.tuning.flight.arenaRadius * cfg.spawnFraction;
  const base = world.rng.range(0, TAU);
  for (let k = 0; k < size; k++) {
    const angle = base + (k * TAU) / size + world.rng.range(-0.2, 0.2);
    const heading = angle + Math.PI + world.rng.range(-0.3, 0.3);
    // The retarget timer is staggered so the whole wave does not re-pick targets in the same step.
    spawnFighter(
      world,
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      heading,
      world.rng.range(0, cfg.retargetInterval),
    );
  }
}

/**
 * Resolves fighter kills, then starts the next wave once none are left alive and `waveDelay` has
 * passed since the last one went down (or at once if there never was one). Runs after enemy shots,
 * so this step's bullet and missile damage is already applied. `waveSize` 0 turns waves off.
 * Wave state lives in `world.fighters` itself (`diedAt`), so a respawn that clears it restarts waves.
 */
export function stepWaves(world: World): void {
  resolveFighterKills(world);
  if (world.tuning.arena.enemiesFrozen) return; // debug freeze: no new waves
  const cfg = world.tuning.fighter;
  if (cfg.waveSize <= 0) return;
  let lastDeath = NO_HIT;
  for (const f of world.fighters) {
    if (f.alive) return;
    if (f.diedAt > lastDeath) lastDeath = f.diedAt;
  }
  if (world.fighters.length > 0 && world.time - lastDeath < cfg.waveDelay) return;
  spawnWave(world);
}
