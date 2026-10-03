import { describe, expect, it } from 'vitest';
import { createTuning } from '../../../data/tuning';
import { FIGHTER_ID_BASE, forEachLockable, getLockable } from './lockable';
import { createWorld } from './world';

describe('lockable ids', () => {
  const world = createWorld(1, createTuning());
  world.fighters.push({ x: 10, y: 20, vx: 1, vy: 2, radius: 28, hp: 3, alive: true });
  world.fighters.push({ x: 99, y: 99, vx: 0, vy: 0, radius: 28, hp: 0, alive: false });

  it('visits living targets by index and living fighters from FIGHTER_ID_BASE', () => {
    const ids: number[] = [];
    forEachLockable(world, (id) => ids.push(id));
    expect(ids.filter((i) => i < FIGHTER_ID_BASE)).toHaveLength(world.targets.length);
    expect(ids.filter((i) => i >= FIGHTER_ID_BASE)).toEqual([FIGHTER_ID_BASE]);
  });

  it('skips dead targets', () => {
    world.targets[0]!.alive = false;
    let visited = 0;
    forEachLockable(world, () => visited++);
    expect(visited).toBe(world.targets.length - 1 + 1);
  });

  it('resolves ids back to the mutable body, and unknown ids to undefined', () => {
    expect(getLockable(world, FIGHTER_ID_BASE)).toBe(world.fighters[0]);
    expect(getLockable(world, 2)).toBe(world.targets[2]);
    expect(getLockable(world, FIGHTER_ID_BASE + 50)).toBeUndefined();
  });
});
