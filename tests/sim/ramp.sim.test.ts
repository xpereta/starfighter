import { expect, it } from 'vitest';
import { createTuning } from '../../data/tuning';
import { SHIP_GUNSHIP } from '../../src/core/ai/fighter';
import { hashWorld } from '../../src/core/replay/hash';
import {
  parseReplay,
  runReplay,
  serializeReplay,
  startRecording,
} from '../../src/core/replay/replay';
import { createRng } from '../../src/core/rng/rng';
import { coreIndex, killPart } from '../../src/core/enemies/capital';
import { devJumpTo, devNextWave } from '../../src/core/run/dev-actions';
import { enterStartScreen, offerVeterans } from '../../src/core/run/run';
import { createWorld, stepWorld, type World } from '../../src/core/world/world';

const DT = 1 / 60;
const MAX_STEPS = 20 * 60 * 60; // twenty simulated minutes: a run must end well before this

interface Seen {
  gunships: number;
  wings: number;
  wingBroken: Record<string, number>;
  gunshipShots: number;
  maxShots: number;
  maxFighters: number;
  battles: Set<number>;
}

/**
 * A scripted bot plays a whole run under the authored ramp: random flight and fire in battle,
 * random menu presses in menus. An `assist` bot has a big hull and every 8 s its shots happen to
 * destroy everything flying, which walks the run through every battle. Pools are checked every step.
 */
function playRun(
  seed: number,
  options: { assist?: boolean; classic?: boolean; record?: boolean } = {},
): { world: World; steps: number; seen: Seen; replayHash?: string } {
  const world = createWorld(seed, createTuning());
  // A replay only accepts a hull inside the parameter range (20 at most).
  if (options.assist) world.tuning.run.playerHull = options.record ? 20 : 500;
  if (options.classic) world.tuning.run.ramp = 'classic';
  world.tuning.fighter.waveDelay = 2;
  enterStartScreen(world);
  offerVeterans(world, [{ id: 1, name: 'Old Hand', trait: 'steady', kills: 9 }]);
  const recorder = options.record ? startRecording(world) : null;
  const rng = createRng(seed + 99);
  const a = world.actions;
  const seen: Seen = {
    gunships: 0,
    wings: 0,
    wingBroken: {},
    gunshipShots: 0,
    maxShots: 0,
    maxFighters: 0,
    battles: new Set(),
  };
  const limit = world.tuning.flight.arenaRadius + 1500;
  let steps = 0;
  const wingKeys = new Set<string>();
  while (world.run.phase !== 'end' && steps < MAX_STEPS) {
    steps++;
    if (world.run.phase === 'battle') {
      seen.battles.add(world.run.battle);
      if (steps % 20 === 0) {
        a.steerX = rng.range(-1, 1);
        a.steerY = rng.range(-1, 1);
        a.throttle = rng.range(-0.5, 1);
        a.fire = rng.next() < 0.8;
        a.evade = rng.next() < 0.1;
        a.launch = rng.next() < 0.05;
      }
      if (options.assist && steps % 480 === 0) {
        for (const f of world.fighters) f.hp = 0;
        // Battle 4: the boss. Its core goes too (the death chain then ends the battle).
        const cap = world.enemies.capital;
        if (cap && cap.phase === 0) killPart(world, coreIndex());
      }
    } else {
      a.menuUp = a.menuDown = a.menuSelect = a.menuBack = false;
      if (steps % 6 === 0) {
        const roll = rng.next();
        if (roll < 0.35) a.menuSelect = true;
        else if (roll < 0.65) a.menuDown = true;
        else if (roll < 0.85) a.menuUp = true;
        else a.menuBack = true;
      }
    }
    recorder?.record(world.tick, a);
    stepWorld(world, DT);

    for (const e of world.events.events) {
      if (e.type === 'EnemySpawned' && e.kind === 'gunship') seen.gunships++;
      else if (e.type === 'WingBroken')
        seen.wingBroken[e.reason] = (seen.wingBroken[e.reason] ?? 0) + 1;
      else if (e.type === 'EnemyShotFired' && e.from === 'gunship') seen.gunshipShots++;
    }
    // The wing list is cleared at each battle start, so a wing is told apart by battle and index.
    for (let i = 0; i < world.enemies.wings.length; i++) wingKeys.add(`${world.run.battle}:${i}`);
    seen.wings = wingKeys.size;
    seen.maxShots = Math.max(seen.maxShots, world.enemyShots.count);
    seen.maxFighters = Math.max(seen.maxFighters, world.fighters.length);
    if (world.enemyShots.count > world.enemyShots.capacity)
      throw new Error('enemy shot pool over cap');
    for (const f of world.fighters) {
      const s = f.ship;
      if (!Number.isFinite(s.x + s.y + s.heading + s.speed + f.hp)) throw new Error('NaN fighter');
      if (Math.hypot(s.x, s.y) > limit) throw new Error('fighter left the arena');
    }
    if (world.run.hull < 0 || world.run.hull > world.tuning.run.playerHull)
      throw new Error('hull out of range');
    if (!Number.isFinite(world.ship.x + world.ship.y + world.ship.speed))
      throw new Error('NaN ship');
  }
  let replayHash: string | undefined;
  if (recorder) {
    const replay = recorder.finish(world);
    replayHash = hashWorld(runReplay(parseReplay(serializeReplay(replay))));
  }
  return { world, steps, seen, replayHash };
}

it.each([1, 2, 3, 4, 5, 6])(
  'a scripted bot finishes a whole run under the authored ramp (seed %i): finite, bounded, it always ends',
  (seed) => {
    const { world, steps, seen } = playRun(seed, { assist: seed > 3 });
    expect(world.run.phase, `still in ${world.run.phase} after ${steps} steps`).toBe('end');
    expect(['victory', 'defeat']).toContain(world.run.result);
    // Dead slots are reused, so the fighter list stays within the biggest single wave plus carry-over.
    expect(seen.maxFighters).toBeLessThan(60);
  },
);

it('an assisted run walks through every battle and meets wings and gunships', () => {
  const { world, seen } = playRun(5, { assist: true });
  expect(world.run).toMatchObject({ phase: 'end', result: 'victory' });
  expect([...seen.battles].sort()).toEqual([1, 2, 3, 4]);
  expect(seen.wings).toBeGreaterThanOrEqual(4); // 1 in battle 1, 1 in battle 2, 2 in battle 3
  expect(seen.gunships).toBe(3); // 1 in battle 2, 2 in battle 3
  const broken = Object.values(seen.wingBroken).reduce((n, m) => n + m, 0);
  expect(broken).toBeGreaterThan(0);
  expect(broken).toBeLessThanOrEqual(seen.wings);
  expect(seen.maxShots).toBeLessThanOrEqual(world.enemyShots.capacity);
});

it('the classic ramp is still selectable and still ends (no wings, no gunships)', () => {
  const { world, seen } = playRun(5, { assist: true, classic: true });
  expect(world.run).toMatchObject({ phase: 'end', result: 'victory' });
  expect(seen.wings).toBe(0);
  expect(seen.gunships).toBe(0);
  expect(world.fighters.every((f) => f.shipType !== SHIP_GUNSHIP)).toBe(true);
});

it('a gunship that reaches the player shoots (battle 2 forced to its gunship wave, big hull)', () => {
  const world = createWorld(21, createTuning());
  world.tuning.run.playerHull = 20;
  world.tuning.fighter.waveDelay = 2;
  devJumpTo(world, { kind: 'battle', n: 2 });
  devNextWave(world); // wave 1: fighters
  devNextWave(world); // wave 2 of battle 2: fighters and the gunship
  expect(world.fighters.some((f) => f.shipType === SHIP_GUNSHIP)).toBe(true);
  for (const f of world.fighters) if (f.shipType !== SHIP_GUNSHIP) f.hp = 0; // the gunship alone
  let shots = 0;
  let hits = 0;
  for (let i = 0; i < 120 * 60 && world.run.phase === 'battle'; i++) {
    world.actions.throttle = -1; // the player just waits near the middle
    stepWorld(world, DT);
    for (const e of world.events.events) {
      if (e.type === 'EnemyShotFired' && e.from === 'gunship') shots++;
      if (e.type === 'PlayerDamaged') hits++;
    }
    expect(world.enemyShots.count).toBeLessThanOrEqual(world.enemyShots.capacity);
  }
  expect(shots).toBeGreaterThan(0);
  expect(hits).toBeGreaterThan(0);
});

it('a whole unassisted run under the authored ramp is deterministic and replays to the same hash', () => {
  // Nothing outside the recorded inputs (no cheats) so the replay can reproduce it.
  const a = playRun(7, { record: true });
  const b = playRun(7, { record: true });
  expect(hashWorld(a.world)).toBe(hashWorld(b.world));
  expect(a.replayHash).toBe(hashWorld(a.world));
});
