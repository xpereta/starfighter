import { spawnLancer } from '../core/ai/lancer';
import { spawnFighter } from '../core/ai/waves';
import { createTargetAt } from '../core/world/arena';
import { spawnPodAt } from '../core/world/pods';
import type { EntityKind } from '../core/world/target';
import type { World } from '../core/world/world';

/** What a spawn entry stands for: an enemy kind of the world (`EntityKind` without wingmen) or a rescue pod. */
export type SpawnKind = Exclude<EntityKind, 'wingman'> | 'pod' | 'lancer';

export interface SpawnEntry {
  id: string;
  label: string;
  kind: SpawnKind;
  /** Adds one at (x, y); `heading` points away from the player so ships face them. */
  spawn(world: World, x: number, y: number, heading: number): void;
}

/**
 * The single list behind the panel's Spawn section. A new enemy kind (gunship, formation wing,
 * missile fighter, capital ship...) only needs one entry here and a button appears. When you add a
 * kind to `EntityKind` (core/world/target.ts) the test in `spawn-registry.test.ts` fails until it has one.
 */
export const SPAWN_REGISTRY: readonly SpawnEntry[] = [
  {
    id: 'fighter',
    label: 'Fighter',
    kind: 'fighter',
    // Faces the player, so it comes straight at them like a wave fighter would.
    spawn: (world, x, y, heading) => void spawnFighter(world, x, y, heading + Math.PI),
  },
  {
    id: 'lancer',
    label: 'Missile fighter',
    kind: 'lancer',
    // Faces the player; it keeps 900-1500 u away and fires homing missiles (practice: no hull, a speed knock).
    spawn: (world, x, y, heading) => void spawnLancer(world, x, y, heading + Math.PI),
  },
  {
    id: 'drone',
    label: 'Drone',
    kind: 'drone',
    spawn: (world, x, y, heading) =>
      void world.targets.push(createTargetAt('drone', world.tuning.arena, x, y, heading)),
  },
  {
    id: 'turret',
    label: 'Turret',
    kind: 'turret',
    spawn: (world, x, y, heading) =>
      void world.targets.push(createTargetAt('turret', world.tuning.arena, x, y, heading)),
  },
  {
    id: 'static',
    label: 'Static dummy',
    kind: 'static',
    spawn: (world, x, y, heading) =>
      void world.targets.push(createTargetAt('static', world.tuning.arena, x, y, heading)),
  },
  {
    id: 'pod',
    label: 'Rescue pod',
    kind: 'pod',
    spawn: (world, x, y, heading) => spawnPodAt(world, x, y, heading),
  },
];

/** How many to spawn per click, the choices of the count control. */
export const SPAWN_COUNTS: readonly number[] = [1, 3, 5];

/** Distance in front of the ship where spawns appear (u), and the gap between neighbours in a row (u). */
export const SPAWN_DISTANCE = 1100;
export const SPAWN_SPACING = 260;
/** Spawns stay this fraction of the arena radius from the middle at most. */
const ARENA_MARGIN = 0.9;

/** Positions for `count` spawns in a row across the ship's nose: [x, y] pairs. Pure. */
export function spawnPositions(
  ship: { x: number; y: number; heading: number },
  count: number,
  arenaRadius: number,
): [number, number][] {
  // Heading 0 points along +x and heading grows counter-clockwise (see core/flight).
  const fx = Math.cos(ship.heading);
  const fy = Math.sin(ship.heading);
  const out: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    const side = (i - (count - 1) / 2) * SPAWN_SPACING;
    let x = ship.x + fx * SPAWN_DISTANCE - fy * side;
    let y = ship.y + fy * SPAWN_DISTANCE + fx * side;
    const limit = arenaRadius * ARENA_MARGIN;
    const d = Math.hypot(x, y);
    if (d > limit) {
      x *= limit / d;
      y *= limit / d;
    }
    out.push([x, y]);
  }
  return out;
}

/** Spawns `count` of an entry in front of the player. Returns how many were added. */
export function spawnAhead(world: World, entry: SpawnEntry, count: number): number {
  const { ship } = world;
  const positions = spawnPositions(ship, count, world.tuning.flight.arenaRadius);
  for (const [x, y] of positions) entry.spawn(world, x, y, ship.heading);
  return positions.length;
}
