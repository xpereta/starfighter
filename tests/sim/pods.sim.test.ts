import { expect, it } from 'vitest';
import { createTuning } from '../../data/tuning';
import { hashWorld } from '../../src/core/replay/hash';
import { createRng } from '../../src/core/rng/rng';
import { enterStartScreen } from '../../src/core/run/run';
import { coreIndex, killPart } from '../../src/core/enemies/capital';
import { createWorld, stepWorld, type World } from '../../src/core/world/world';

const DT = 1 / 60;
const MAX_STEPS = 20 * 60 * 60;

/**
 * A whole run through the real menus (Start, four battles, debriefs) with an assisted bot: big hull,
 * and the fighters on the field are destroyed every eight seconds. In battle it flies at the pod when
 * there is one, so rescues happen; in menus it presses select, so it takes every pick.
 */
function play(seed: number): {
  world: World;
  spawnedIn: number[];
  rescued: number;
  lost: number;
} {
  const tuning = createTuning();
  tuning.run.playerHull = 500;
  tuning.fighter.waveDelay = 2;
  const world = createWorld(seed, tuning);
  enterStartScreen(world);
  const rng = createRng(seed * 7 + 1);
  const a = world.actions;
  const arena = tuning.flight.arenaRadius;
  const spawnedIn: number[] = [];
  let rescued = 0;
  let lost = 0;
  for (let step = 1; world.run.phase !== 'end' && step < MAX_STEPS; step++) {
    if (world.run.phase === 'battle') {
      if (step % 20 === 0) {
        a.steerX = rng.range(-1, 1);
        a.steerY = rng.range(-1, 1);
        a.throttle = rng.range(-1, 1);
        a.fire = rng.next() < 0.6;
      }
      // The assist: from its second battle on the bot parks the ship beside the pod (steering to it is
      // the pilot's job, not this test's).
      const pod = world.pods.find((p) => p.alive);
      if (pod) {
        world.ship.x = pod.x + 20;
        world.ship.y = pod.y;
      }
      if (step % 480 === 0) {
        for (const f of world.fighters) f.hp = 0;
        if (world.enemies.capital?.phase === 0) killPart(world, coreIndex()); // battle 4's boss
      }
    } else {
      a.menuSelect = step % 12 === 0; // select, let go, select again
    }
    stepWorld(world, DT);
    for (const e of world.events.events) {
      if (e.type === 'PodSpawned') spawnedIn.push(world.run.battle);
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
  return { world, spawnedIn, rescued, lost };
}

it.each([1, 2, 3])(
  'a whole run (seed %i): pods only in battles 2 and 3, at most one per battle, all bounded',
  (seed) => {
    const { world, spawnedIn } = play(seed);
    expect(world.run.phase).toBe('end');
    for (const battle of spawnedIn) expect([2, 3]).toContain(battle);
    expect(new Set(spawnedIn).size).toBe(spawnedIn.length); // never two in one battle
    expect(spawnedIn).toContain(2); // the squad has room in battle 2 (2 pilots, at most 1 picked)
  },
);

it('rescued pilots really join the squad, with distinct names', () => {
  let total = 0;
  for (const seed of [1, 2, 3, 4, 5]) {
    const { world, rescued } = play(seed);
    total += rescued;
    const names = world.pilots.roster.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
    const joined = world.pilots.roster.length;
    expect(joined).toBeLessThanOrEqual(world.tuning.run.startingSquad + 3 + rescued); // start, picks, rescues
  }
  expect(total).toBeGreaterThan(0); // the bot rescues at least one pod across five runs
});

it('is deterministic: the same seed gives the same final state', () => {
  expect(hashWorld(play(2).world)).toBe(hashWorld(play(2).world));
});
