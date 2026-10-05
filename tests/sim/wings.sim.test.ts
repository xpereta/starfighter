import { expect, it } from 'vitest';
import { createTuning } from '../../data/tuning';
import { spawnWing } from '../../src/core/ai/wings';
import { hashWorld } from '../../src/core/replay/hash';
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
  a.launch = rng.next() < 0.05;
}

/** A practice world where a wing arrives every 15 s on top of the normal waves, against a random bot. */
function fight(seed: number, seconds: number): { world: World; broken: string[]; wings: number } {
  const world = createWorld(seed, createTuning());
  const rng = createRng(seed + 1);
  const limit = world.tuning.flight.arenaRadius + 1500;
  const broken: string[] = [];
  for (let i = 0; i < seconds * 60; i++) {
    if (i % 20 === 0) randomInputs(world, rng);
    if (i % (15 * 60) === 0) spawnWing(world, 3000, 800, Math.PI);
    stepWorld(world, DT);
    for (const e of world.events.events) if (e.type === 'WingBroken') broken.push(e.reason);
    expect(world.enemyShots.count).toBeLessThanOrEqual(world.enemyShots.capacity);
    for (const f of world.fighters) {
      const s = f.ship;
      if (!Number.isFinite(s.x + s.y + s.heading + s.speed + f.hp)) throw new Error('NaN fighter');
      expect(Math.hypot(s.x, s.y)).toBeLessThan(limit);
    }
    for (const w of world.enemies.wings) {
      expect(w.leader).toBeLessThan(world.fighters.length);
      for (const m of w.members) expect(m).toBeLessThan(world.fighters.length);
    }
  }
  return { world, broken, wings: world.enemies.wings.length };
}

it('120 s of formation wings against a random bot: finite, bounded, and every wing ends up broken', () => {
  const { world, broken, wings } = fight(12, 120);
  expect(wings).toBeGreaterThanOrEqual(8);
  expect(broken.length).toBeGreaterThan(0);
  expect(broken.length).toBeLessThanOrEqual(wings);
  for (const reason of broken) expect(['leader', 'fire', 'proximity']).toContain(reason);
  expect(world.fighters.length).toBeLessThan(60); // dead slots are reused: the list stays small
  // A wing that is still intact at the end is a fresh one (it arrived in the last 15 s).
  const intact = world.enemies.wings.filter((w) => !w.broken);
  for (const w of intact) expect(world.time - w.born).toBeLessThanOrEqual(15 + 1);
});

it('two identical wing fights end in the same state', () => {
  expect(hashWorld(fight(3, 45).world)).toBe(hashWorld(fight(3, 45).world));
});
