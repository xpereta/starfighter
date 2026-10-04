import { expect, it } from 'vitest';
import { createTuning } from '../../../data/tuning';
import { spawnFighter } from '../ai/waves';
import { livingWingmen } from '../squadron/squadron';
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

it('Prototype 2 slots exist and start empty, and respawn clears them', () => {
  const tuning = createTuning();
  tuning.fighter.waveSize = 0; // otherwise a wave arrives in the very step that respawns
  const world = createWorld(3, tuning);
  expect(world.lockon.locks).toEqual([]);
  expect(world.missiles.count).toBe(0);
  expect(world.fighters).toEqual([]);
  expect(world.squadron.wingmen).toEqual([]);
  expect(livingWingmen(world.squadron)).toBe(0);
  world.lockon.locks.push(4);
  world.missiles.spawn();
  spawnFighter(world, 0, 0, 0);
  world.squadron.formation = 'spread';
  world.actions.respawn = true;
  stepWorld(world, 1 / 60);
  expect(world.lockon.locks).toEqual([]);
  expect(world.missiles.count).toBe(0);
  expect(world.fighters).toEqual([]);
  expect(world.squadron.formation).toBe('tight');
});

it('the new buttons are edge-tracked at the end of the step', () => {
  const world = createWorld(3, createTuning());
  world.actions.launch = true;
  expect(world.prev.launch).toBe(false);
  stepWorld(world, 1 / 60);
  expect(world.prev.launch).toBe(true); // modules saw prev=false during the step that pressed it
});

it('Prototype 3 slots exist: practice mode by default, an empty roster and no pods', () => {
  const world = createWorld(3, createTuning());
  expect(world.run).toMatchObject({
    mode: 'practice',
    phase: 'battle',
    battle: 0,
    wave: 0,
    result: 'none',
  });
  expect(world.pilots).toEqual({ roster: [], nextId: 1 });
  expect(world.pods).toEqual([]);
  world.pods.push({ x: 1, y: 2, vx: 0, vy: 0, hp: 3, alive: true, progress: 0, pilotId: 1 });
  world.actions.respawn = true;
  stepWorld(world, 1 / 60);
  expect(world.pods).toEqual([]); // a respawn clears pods
});

it('the menu buttons are edge-tracked at the end of the step', () => {
  const world = createWorld(3, createTuning());
  world.actions.menuSelect = true;
  expect(world.prev.menuSelect).toBe(false);
  stepWorld(world, 1 / 60);
  expect(world.prev.menuSelect).toBe(true);
});
