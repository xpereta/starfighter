import { expect, it } from 'vitest';
import { createTuning } from '../../data/tuning';
import { createRng } from '../../src/core/rng/rng';
import { createWorld, stepWorld } from '../../src/core/world/world';

const DT = 1 / 60;

it('120 s of random flight and fire: arena stays finite, pools within caps, drones near the arena', () => {
  const tuning = createTuning();
  const world = createWorld(5, tuning);
  const rng = createRng(21);
  const a = world.actions;
  const limit = tuning.flight.arenaRadius + 3 * tuning.arena.droneSpeedMax;
  for (let i = 0; i < 120 * 60; i++) {
    if (i % 25 === 0) {
      a.steerX = rng.range(-1, 1);
      a.steerY = rng.range(-1, 1);
      a.throttle = rng.range(-1, 1);
      a.fire = rng.next() < 0.8;
    }
    stepWorld(world, DT);
    expect(world.bullets.count).toBeLessThanOrEqual(world.bullets.capacity);
    expect(world.enemyShots.count).toBeLessThanOrEqual(world.enemyShots.capacity);
    for (const t of world.targets) {
      expect(Number.isFinite(t.x + t.y + t.hp)).toBe(true);
      if (t.kind === 'drone' && t.mode === 'straight')
        expect(Math.hypot(t.x, t.y)).toBeLessThan(limit);
    }
  }
  expect(world.stats.kills).toBeGreaterThanOrEqual(0);
});

it('a time trial can be started and completed through the world step', () => {
  const world = createWorld(9, createTuning());
  world.actions.startTrial = true;
  stepWorld(world, DT);
  expect(world.trial.active).toBe(true);
  world.actions.startTrial = false;
  for (let i = 0; i < 120; i++) stepWorld(world, DT);
  for (const t of world.targets) if (t.kind === 'drone') t.hp = 0;
  stepWorld(world, DT);
  expect(world.trial.active).toBe(false);
  expect(world.trial.best).toBeGreaterThan(2);
  expect(world.trial.best).toBe(world.trial.last);
  // Drones stay down during a trial but a new start brings them back.
  expect(world.targets.filter((t) => t.kind === 'drone' && t.alive)).toHaveLength(0);
  world.actions.startTrial = true;
  stepWorld(world, DT);
  expect(world.targets.filter((t) => t.kind === 'drone' && t.alive)).toHaveLength(10);
});
