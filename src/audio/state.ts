import type { World } from '../core/world/world';
import type { MusicInput } from './conductor';
import { zeroLoopState, type LoopState } from './loops';
import type { Scene } from './score';

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/**
 * Reads the world into what the music follows: which scene (Start screen, flying, debrief, end), how
 * many enemies are alive, the hull and the rescue progress. Pure and read-only, like `loopStateOf`.
 */
export function musicInputOf(world: World): MusicInput {
  const { run, tuning } = world;
  const scene: Scene =
    run.mode === 'practice'
      ? 'flight'
      : run.phase === 'start'
        ? 'menu'
        : run.phase === 'battle'
          ? 'flight'
          : run.phase === 'debrief'
            ? 'debrief'
            : 'end';
  let enemies = 0;
  for (const f of world.fighters) if (f.alive) enemies++;
  for (const t of world.targets) if (t.kind === 'turret' && t.alive) enemies++;
  let rescue = 0;
  for (const pod of world.pods) {
    if (pod.alive && !pod.rescued) rescue = Math.max(rescue, pod.progress);
  }
  return {
    scene,
    enemies,
    hull: run.mode === 'run' ? clamp(run.hull / Math.max(1, tuning.run.playerHull), 0, 1) : 1,
    rescue: clamp(rescue, 0, 1),
  };
}

/** Missiles in the air that count as "full" for the `missiles` value. */
export const MISSILES_FULL = 3;

/**
 * Reads the world into the numbers the loops follow. Pure and read-only: audio never writes the
 * world. Outside a battle (menus, the start and end screens) everything is 0 so the loops fade away.
 */
export function loopStateOf(world: World): LoopState {
  if (world.run.phase !== 'battle') return zeroLoopState();
  const { ship, run, tuning } = world;
  let rescue = 0;
  for (const pod of world.pods) {
    if (pod.alive && !pod.rescued) rescue = Math.max(rescue, pod.progress);
  }
  return {
    speed: clamp(ship.speed / Math.max(1, tuning.flight.maxSpeed), 0, 1),
    throttle: clamp(world.actions.throttle, -1, 1),
    hull: run.mode === 'run' ? clamp(run.hull / Math.max(1, tuning.run.playerHull), 0, 1) : 1,
    rescue: clamp(rescue, 0, 1),
    missiles: clamp(world.missiles.count / MISSILES_FULL, 0, 1),
    edge: ship.outside ? 1 : 0,
    always: 1,
  };
}
