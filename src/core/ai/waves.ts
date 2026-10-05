import type { FlightConfig } from '../../../data/tuning/flight';
import type { BattleGroup, BattleWave } from '../enemies/battles';
import { TAU } from '../math';
import { FIGHTER_ID_BASE } from '../world/lockable';
import type { World } from '../world/world';
import { createFighter, NO_HIT, type Fighter } from './fighter';
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
  const index = placeFighter(world, fighter);
  world.events.emit({ type: 'EnemySpawned', kind: 'fighter', x, y });
  return index;
}

/** Puts a fighter in the first dead slot of `world.fighters` (or at the end). Returns its index. */
export function placeFighter(world: World, fighter: Fighter): number {
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
 * Spawns one group of a battle wave (`count` ships of a kind). Fighters arrive exactly as a
 * classic wave does (`spawnWave`). A kind that has no spawner yet (lancer: track B; capital: track
 * C) is skipped, so a table can already name it.
 */
export function spawnGroup(world: World, group: BattleGroup): void {
  if (group.kind === 'fighter') spawnWave(world, group.count);
}

/** Brings in one wave of the battle table: its groups, in order, all at once. */
export function spawnBattleWave(world: World, wave: BattleWave): void {
  for (const group of wave.groups) spawnGroup(world, group);
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
