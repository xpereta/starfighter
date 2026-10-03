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
