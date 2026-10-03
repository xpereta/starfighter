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
import { createWorld, stepWorld } from '../../src/core/world/world';

const DT = 1 / 60;

it('120 s of random inputs: no NaN, ship within the arena, pools within caps, and the replay reproduces it', () => {
  const tuning = createTuning();
  const world = createWorld(2026, tuning);
  const recorder = startRecording(world);
  const rng = createRng(4242);
  const a = world.actions;
  const arenaLimit = tuning.flight.arenaRadius + 1000;

  for (let i = 0; i < 120 * 60; i++) {
    if (i % 15 === 0) {
      a.steerX = rng.range(-1, 1);
      a.steerY = rng.range(-1, 1);
      a.rotate = rng.int(3) - 1;
      a.throttle = rng.range(-1, 1);
      a.fire = rng.next() < 0.75;
      a.evade = rng.next() < 0.2;
      a.startTrial = rng.next() < 0.01;
      a.respawn = rng.next() < 0.003;
    }
    recorder.record(world.tick, a);
    stepWorld(world, DT);

    const { ship, camera, bullets, enemyShots } = world;
    expect(
      Number.isFinite(ship.x + ship.y + ship.heading + ship.omega + ship.speed + ship.vx + ship.vy),
    ).toBe(true);
    expect(Number.isFinite(camera.x + camera.y + camera.view)).toBe(true);
    expect(Math.hypot(ship.x, ship.y)).toBeLessThan(arenaLimit);
    expect(bullets.count).toBeLessThanOrEqual(bullets.capacity);
    expect(enemyShots.count).toBeLessThanOrEqual(enemyShots.capacity);
    for (const t of world.targets) expect(Number.isFinite(t.x + t.y + t.hp)).toBe(true);
  }

  const replay = recorder.finish(world);
  expect(replay.ticks).toBe(7200);
  expect(replay.inputs.length).toBeLessThan(7200); // run-length encoded
  const rerun = runReplay(parseReplay(serializeReplay(replay)));
  expect(hashWorld(rerun)).toBe(hashWorld(world));
});
