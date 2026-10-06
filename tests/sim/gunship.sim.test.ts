import { expect, it } from 'vitest';
import { createTuning } from '../../data/tuning';
import { SHIP_GUNSHIP } from '../../src/core/ai/fighter';
import { spawnGunship } from '../../src/core/ai/gunship';
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
  a.launch = rng.next() < 0.05;
}

/** A practice world where two gunships come in every 20 s on top of the normal waves. */
function fight(seed: number, seconds: number, onStep?: (w: World, i: number) => void): World {
  const world = createWorld(seed, createTuning());
  const rng = createRng(seed + 1);
  const limit = world.tuning.flight.arenaRadius + 1500;
  for (let i = 0; i < seconds * 60; i++) {
    if (i % 20 === 0) randomInputs(world, rng);
    if (i % (20 * 60) === 0) {
      spawnGunship(world, 3000, 1000, Math.PI);
      spawnGunship(world, -3000, -1000, 0);
    }
    stepWorld(world, DT);
    onStep?.(world, i);
    expect(world.enemyShots.count).toBeLessThanOrEqual(world.enemyShots.capacity);
    for (const f of world.fighters) {
      const s = f.ship;
      if (!Number.isFinite(s.x + s.y + s.heading + s.speed + f.hp)) throw new Error('NaN fighter');
      expect(Math.hypot(s.x, s.y)).toBeLessThan(limit);
      for (const m of f.mounts) {
        expect(Number.isFinite(m.aim + m.cooldown + m.pause)).toBe(true);
        expect(m.burstLeft).toBeGreaterThanOrEqual(0);
      }
    }
  }
  return world;
}

it('120 s of gunships and fighters against a random bot: finite, in the arena, bounded pools', () => {
  let maxShots = 0;
  let gunshipsSeen = 0;
  const world = fight(21, 120, (w) => {
    maxShots = Math.max(maxShots, w.enemyShots.count);
    gunshipsSeen = Math.max(
      gunshipsSeen,
      w.fighters.filter((f) => f.shipType === SHIP_GUNSHIP).length,
    );
  });
  expect(gunshipsSeen).toBeGreaterThanOrEqual(2);
  expect(maxShots).toBeGreaterThan(0);
  expect(maxShots).toBeLessThanOrEqual(world.enemyShots.capacity);
  expect(world.fighters.length).toBeLessThan(40); // dead slots are reused: the list stays small
});

it('gunships can be shot down: a stationary gunship dies to the player guns and counts as a kill', () => {
  const world = createWorld(4, createTuning());
  world.tuning.fighter.waveSize = 0;
  world.tuning.arena.enemiesFrozen = false;
  const i = spawnGunship(world, 400, 0, Math.PI);
  const g = world.fighters[i]!;
  let killed = false;
  for (let k = 0; k < 60 * 20 && !killed; k++) {
    world.actions.fire = true;
    world.actions.throttle = -1;
    // Aim at the gunship: it is the only enemy, and the bot just points at it.
    world.actions.steerX = g.x - world.ship.x;
    world.actions.steerY = g.y - world.ship.y;
    stepWorld(world, DT);
    killed = world.events.events.some((e) => e.type === 'Killed' && e.kind === 'gunship');
    world.run.hull = 0;
  }
  expect(killed).toBe(true);
  expect(g.alive).toBe(false);
  expect(world.stats.kills).toBeGreaterThanOrEqual(1);
});

it('a recorded fight with gunships replays to the same hash, and is repeatable', () => {
  const run = (): { replayHash: string; liveHash: string } => {
    const world = createWorld(33, createTuning());
    const recorder = startRecording(world);
    const rng = createRng(9);
    for (let i = 0; i < 40 * 60; i++) {
      if (i % 20 === 0) randomInputs(world, rng);
      recorder.record(world.tick, world.actions);
      stepWorld(world, DT);
    }
    const replay = recorder.finish(world);
    const again = runReplay(parseReplay(serializeReplay(replay)));
    return { replayHash: hashWorld(again), liveHash: hashWorld(world) };
  };
  // No gunship is spawned in a plain practice replay (the dev spawn is not a recorded input), so
  // this checks that the new state (shipType, mounts) leaves recorded fights reproducible.
  const a = run();
  expect(a.replayHash).toBe(a.liveHash);
  expect(run().liveHash).toBe(a.liveHash);
});

it('two identical gunship fights end in the same state', () => {
  const a = hashWorld(fight(8, 40));
  const b = hashWorld(fight(8, 40));
  expect(a).toBe(b);
});
