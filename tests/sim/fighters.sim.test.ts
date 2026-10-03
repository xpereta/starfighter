import { expect, it } from 'vitest';
import { createTuning } from '../../data/tuning';
import { hashWorld } from '../../src/core/replay/hash';
import {
  parseReplay,
  runReplay,
  serializeReplay,
  startRecording,
} from '../../src/core/replay/replay';
import { createRng } from '../../src/core/rng/rng';
import { createWorld, stepWorld, type World } from '../../src/core/world/world';

const DT = 1 / 60;

function randomInputs(world: World, rng: ReturnType<typeof createRng>): void {
  const a = world.actions;
  a.steerX = rng.range(-1, 1);
  a.steerY = rng.range(-1, 1);
  a.throttle = rng.range(-1, 1);
  a.fire = rng.next() < 0.8;
  a.evade = rng.next() < 0.15;
}

function checkFighters(world: World, limit: number): void {
  expect(world.enemyShots.count).toBeLessThanOrEqual(world.enemyShots.capacity);
  expect(world.bullets.count).toBeLessThanOrEqual(world.bullets.capacity);
  for (const f of world.fighters) {
    const s = f.ship;
    expect(Number.isFinite(s.x + s.y + s.heading + s.omega + s.speed + s.vx + s.vy + f.hp)).toBe(
      true,
    );
    expect(Math.hypot(s.x, s.y)).toBeLessThan(limit);
    expect(f.x).toBe(s.x);
    expect(f.y).toBe(s.y);
  }
  expect(world.fighters.length).toBeLessThanOrEqual(world.tuning.fighter.waveSize);
}

it('120 s with waves cleared every 25 s: finite, in the arena, pools within caps, a fresh wave each time', () => {
  const tuning = createTuning();
  const world = createWorld(77, tuning);
  const rng = createRng(31);
  const limit = tuning.flight.arenaRadius + 1000;
  let maxShots = 0;
  let wavesSeen = 0;
  let wasAlive = false;

  for (let i = 0; i < 120 * 60; i++) {
    if (i % 20 === 0) randomInputs(world, rng);
    // Test-only: wipe the wave now and then so several waves come and go.
    if (i > 0 && i % (25 * 60) === 0) for (const f of world.fighters) f.hp = 0;
    stepWorld(world, DT);

    const alive = world.fighters.some((f) => f.alive);
    if (alive && !wasAlive) wavesSeen++;
    wasAlive = alive;
    maxShots = Math.max(maxShots, world.enemyShots.count);
    checkFighters(world, limit);
  }

  expect(wavesSeen).toBeGreaterThanOrEqual(4);
  expect(maxShots).toBeGreaterThan(0); // the fighters did shoot
});

it('120 s dogfight with random input is fully reproducible from the replay', () => {
  const tuning = createTuning();
  const world = createWorld(78, tuning);
  const recorder = startRecording(world);
  const rng = createRng(32);
  const limit = tuning.flight.arenaRadius + 1000;
  let shots = 0;

  for (let i = 0; i < 120 * 60; i++) {
    if (i % 20 === 0) randomInputs(world, rng);
    recorder.record(world.tick, world.actions);
    stepWorld(world, DT);
    shots += world.enemyShots.count > 0 ? 1 : 0;
    checkFighters(world, limit);
  }

  expect(shots).toBeGreaterThan(0);
  const replay = recorder.finish(world);
  const rerun = runReplay(parseReplay(serializeReplay(replay)));
  expect(hashWorld(rerun)).toBe(hashWorld(world));
});
