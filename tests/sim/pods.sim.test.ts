import { expect, it } from 'vitest';
import { createTuning } from '../../data/tuning';
import { createRng } from '../../src/core/rng/rng';
import { hashWorld } from '../../src/core/replay/hash';
import { createWorld, stepWorld, type World } from '../../src/core/world/world';

const DT = 1 / 60;

/** 120 s of run-mode play: battles 1..4 cycle every 30 s, with waves, turrets and pods in play. */
function play(seed: number): { world: World; spawned: number; rescued: number; lost: number } {
  const tuning = createTuning();
  tuning.arena.turretCount = 3;
  tuning.arena.staticCount = 0;
  tuning.arena.droneCount = 0;
  tuning.squadron.wingmanCount = 2;
  const world = createWorld(seed, tuning);
  world.run.mode = 'run';
  world.run.phase = 'battle';
  const rng = createRng(seed * 7 + 1);
  const a = world.actions;
  const arena = tuning.flight.arenaRadius;
  let spawned = 0;
  let rescued = 0;
  let lost = 0;
  for (let i = 0; i < 120 * 60; i++) {
    world.run.battle = 1 + Math.floor(i / (30 * 60));
    world.run.wave = 2;
    if (i % 20 === 0) {
      const pod = world.pods.find((p) => p.alive);
      if (pod && rng.next() < 0.7) {
        // Fly at the pod most of the time, so rescues actually happen.
        const dx = pod.x - world.ship.x;
        const dy = pod.y - world.ship.y;
        const d = Math.hypot(dx, dy) || 1;
        a.steerX = dx / d;
        a.steerY = dy / d;
        a.throttle = d < 600 ? -0.5 : 0.5;
      } else {
        a.steerX = rng.range(-1, 1);
        a.steerY = rng.range(-1, 1);
        a.throttle = rng.range(-1, 1);
      }
      a.fire = rng.next() < 0.6;
    }
    stepWorld(world, DT);
    for (const e of world.events.events) {
      if (e.type === 'PodSpawned') spawned++;
      else if (e.type === 'PodRescued') rescued++;
      else if (e.type === 'PodLost') lost++;
    }
    for (const pod of world.pods) {
      expect(Number.isFinite(pod.x + pod.y + pod.vx + pod.vy + pod.hp + pod.progress)).toBe(true);
      expect(Math.hypot(pod.x, pod.y)).toBeLessThan(arena * 1.01);
      expect(pod.progress).toBeGreaterThanOrEqual(0);
      expect(pod.progress).toBeLessThanOrEqual(1);
    }
    expect(world.pods.length).toBeLessThanOrEqual(1); // one pod per battle, old ones dropped
    expect(world.enemyShots.count).toBeLessThanOrEqual(world.enemyShots.capacity);
  }
  return { world, spawned, rescued, lost };
}

it('120 s with waves, turrets and pods across four battles: finite, bounded, one pod per pod battle', () => {
  for (const seed of [3, 4, 5]) {
    const { world, spawned, rescued, lost } = play(seed);
    expect(spawned, `seed ${seed}: pods in battles 2 and 3`).toBe(2);
    expect(
      rescued + lost,
      'every pod ended one way or the other, or is still out there',
    ).toBeLessThanOrEqual(2);
    // Rescued pilots are really in the roster, once each.
    const ids = world.pilots.roster.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(world.pilots.roster.length).toBeLessThanOrEqual(2);
  }
});

it('is deterministic: the same seed gives the same pods, roster and hash', () => {
  const a = play(9);
  const b = play(9);
  expect(a.world.pods).toEqual(b.world.pods);
  expect(a.world.pilots).toEqual(b.world.pilots);
  expect(hashWorld(a.world)).toBe(hashWorld(b.world));
});
