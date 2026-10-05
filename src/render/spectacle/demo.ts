import type { GameEvent } from '../../core/events/events';
import type { World } from '../../core/world/world';

/**
 * Synthetic events for the panel's "Demo blasts" button (and the screenshot script): one kill of
 * each kind, a missile impact and some hits, spread ahead of the player. They go to the renderer's
 * effects only (never the simulation or the audio), so nothing in the game changes.
 */
export function demoEvents(world: World): GameEvent[] {
  const { x, y, heading } = world.ship;
  const fx = Math.cos(heading);
  const fy = Math.sin(heading);
  const at = (ahead: number, side: number): { x: number; y: number } => ({
    x: x + fx * ahead - fy * side,
    y: y + fy * ahead + fx * side,
  });
  const kill = (
    id: number,
    kind: 'fighter' | 'drone' | 'turret' | 'static' | 'wingman',
    radius: number,
    ahead: number,
    side: number,
  ): GameEvent => ({ type: 'Killed', entityId: 999000 + id, kind, radius, ...at(ahead, side) });
  const hit = (ahead: number, side: number): GameEvent => ({
    type: 'Hit',
    ...at(ahead, side),
    dirX: fx,
    dirY: fy,
    impulse: 1,
  });
  return [
    kill(1, 'turret', 64, 650, 0),
    kill(2, 'fighter', 38, 420, 300),
    kill(3, 'drone', 30, 380, -280),
    kill(4, 'static', 30, 560, -430),
    kill(5, 'wingman', 34, 520, 440),
    { type: 'MissileImpact', ...at(300, -90) },
    hit(250, 40),
    hit(260, 60),
    hit(240, -50),
  ];
}
