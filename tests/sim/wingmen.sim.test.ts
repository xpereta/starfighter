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
import { livingWingmen } from '../../src/core/squadron/squadron';
import { createWorld, stepWorld, type World } from '../../src/core/world/world';

const DT = 1 / 60;

function randomInputs(world: World, rng: ReturnType<typeof createRng>): void {
  const a = world.actions;
  a.steerX = rng.range(-1, 1);
  a.steerY = rng.range(-1, 1);
  a.throttle = rng.range(-1, 1);
  a.fire = rng.next() < 0.8;
  a.evade = rng.next() < 0.15;
  // Order buttons: pressed for a moment now and then (the inputs change every 20 steps).
  a.cycleFormation = rng.next() < 0.1;
  a.attackOrder = rng.next() < 0.1;
}

/** Counts how long each pair of wingmen has been on top of each other, in consecutive steps. */
function trackStacking(world: World, stacked: Map<string, number>, limit: number): number {
  const ws = world.squadron.wingmen;
  let longest = 0;
  for (let p = 0; p < ws.length; p++) {
    for (let q = p + 1; q < ws.length; q++) {
      const a = ws[p]!;
      const b = ws[q]!;
      const key = `${p}-${q}`;
      const close =
        a.alive && b.alive && Math.hypot(a.ship.x - b.ship.x, a.ship.y - b.ship.y) < limit;
      const run = close ? (stacked.get(key) ?? 0) + 1 : 0;
      stacked.set(key, run);
      longest = Math.max(longest, run);
    }
  }
  return longest;
}

it('120 s with 4 wingmen and waves: finite, inside the arena, pools within caps, none stuck on another', () => {
  const tuning = createTuning();
  tuning.squadron.wingmanCount = 4;
  const world = createWorld(55, tuning);
  const rng = createRng(9);
  const limit = tuning.flight.arenaRadius + 1000;
  const stacked = new Map<string, number>();
  let longestStack = 0;
  let fell = 0;
  let orders = 0;
  let sawAllAlive = false;

  for (let i = 0; i < 120 * 60; i++) {
    if (i % 20 === 0) randomInputs(world, rng);
    stepWorld(world, DT);
    orders += world.events.events.filter((e) => e.type === 'OrderGiven').length;

    expect(world.enemyShots.count).toBeLessThanOrEqual(world.enemyShots.capacity);
    expect(world.bullets.count).toBeLessThanOrEqual(world.bullets.capacity);
    expect(world.squadron.wingmen.length).toBe(4);
    if (livingWingmen(world.squadron) === 4) sawAllAlive = true;
    for (const w of world.squadron.wingmen) {
      const s = w.ship;
      expect(Number.isFinite(s.x + s.y + s.heading + s.omega + s.speed + s.vx + s.vy + w.hp)).toBe(
        true,
      );
      if (w.alive) expect(Math.hypot(s.x, s.y)).toBeLessThan(limit);
    }
    longestStack = Math.max(longestStack, trackStacking(world, stacked, tuning.squadron.radius));
    fell += world.events.events.filter((e) => e.type === 'Killed' && e.kind === 'wingman').length;
  }

  expect(sawAllAlive).toBe(true);
  expect(longestStack).toBeLessThan(150); // never stuck on top of another for 2.5 s
  expect(fell).toBeGreaterThanOrEqual(0);
  expect(orders).toBeGreaterThan(0); // the random order presses did something
});

it('120 s with the default 2 wingmen is fully reproducible from the replay', () => {
  const tuning = createTuning();
  const world = createWorld(56, tuning);
  const recorder = startRecording(world);
  const rng = createRng(10);

  for (let i = 0; i < 120 * 60; i++) {
    if (i % 20 === 0) randomInputs(world, rng);
    recorder.record(world.tick, world.actions);
    stepWorld(world, DT);
  }

  const replay = recorder.finish(world);
  const rerun = runReplay(parseReplay(serializeReplay(replay)));
  expect(hashWorld(rerun)).toBe(hashWorld(world));
  expect(rerun.squadron.wingmen).toHaveLength(2);
});
