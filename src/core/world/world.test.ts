import { expect, it } from 'vitest';
import { createTuning } from '../../../data/tuning';
import { createWorld, stepWorld } from './world';

it('advances tick and time and clears events each step', () => {
  const world = createWorld(1, createTuning());
  world.events.emit({ type: 'EvadeStarted', x: 0, y: 0, side: 1 });
  stepWorld(world, 1 / 60);
  expect(world.tick).toBe(1);
  expect(world.time).toBeCloseTo(1 / 60);
  expect(world.events.events).toHaveLength(0);
});

it('is deterministic for the same seed', () => {
  const a = createWorld(99, createTuning());
  const b = createWorld(99, createTuning());
  for (let i = 0; i < 10; i++) expect(a.rng.next()).toBe(b.rng.next());
});

it('respawn resets the ship and shots once per press (edge-triggered)', () => {
  const world = createWorld(3, createTuning());
  world.ship.x = 999;
  world.bullets.spawn();
  world.actions.respawn = true;
  stepWorld(world, 1 / 60);
  expect(Math.abs(world.ship.x)).toBeLessThan(10);
  expect(world.bullets.count).toBe(0);
  // Holding the button does not reset again.
  world.ship.x = 500;
  stepWorld(world, 1 / 60);
  expect(world.ship.x).toBeGreaterThan(400);
  world.actions.respawn = false;
  stepWorld(world, 1 / 60);
  world.actions.respawn = true;
  stepWorld(world, 1 / 60);
  expect(Math.abs(world.ship.x)).toBeLessThan(10);
});

it('keeps the best trial time across respawns and starts from a saved best', () => {
  const world = createWorld(3, createTuning(), 33.3);
  expect(world.trial.best).toBe(33.3);
  world.actions.respawn = true;
  stepWorld(world, 1 / 60);
  expect(world.trial.best).toBe(33.3);
});
