import { expect, it } from 'vitest';
import { createTuning } from '../../data/tuning';
import { createRng } from '../../src/core/rng/rng';
import {
  devClearBattle,
  devJumpTo,
  devNextWave,
  jumpTargets,
} from '../../src/core/run/dev-actions';
import { enterStartScreen, menuRows } from '../../src/core/run/run';
import { createWorld, stepWorld, type World } from '../../src/core/world/world';
import { SPAWN_REGISTRY, spawnAhead } from '../../src/dev/spawn-registry';

const DT = 1 / 60;

function check(world: World): void {
  const { ship, run } = world;
  if (!Number.isFinite(ship.x + ship.y + ship.speed + ship.heading)) throw new Error('NaN ship');
  for (const f of world.fighters) {
    if (!Number.isFinite(f.x + f.y + f.hp)) throw new Error('NaN fighter');
  }
  for (const t of world.targets) {
    if (!Number.isFinite(t.x + t.y + t.hp)) throw new Error('NaN target');
  }
  for (const w of world.squadron.wingmen) {
    if (!Number.isFinite(w.ship.x + w.ship.y + w.hp)) throw new Error('NaN wingman');
  }
  if (run.phase !== 'battle' && (run.cursor < 0 || run.cursor >= menuRows(run)))
    throw new Error('cursor out of range');
  if (run.hull < 0 || run.hull > world.tuning.run.playerHull) throw new Error('hull out of range');
  if (world.bullets.count > world.bullets.capacity) throw new Error('bullet pool over cap');
  if (world.missiles.count > world.missiles.capacity) throw new Error('missile pool over cap');
  if (world.enemyShots.count > world.enemyShots.capacity) throw new Error('shot pool over cap');
}

/** A bot that flies and fires at random for `steps` steps, checking the world every step. */
function fly(world: World, rng: ReturnType<typeof createRng>, steps: number): void {
  const a = world.actions;
  for (let i = 0; i < steps; i++) {
    if (i % 20 === 0) {
      a.steerX = rng.range(-1, 1);
      a.steerY = rng.range(-1, 1);
      a.throttle = rng.range(-0.5, 1);
      a.fire = rng.next() < 0.8;
      a.launch = rng.next() < 0.05;
    }
    stepWorld(world, DT);
    check(world);
  }
}

it('jumping through every target, spawning everything, keeps the world valid and the run completes', () => {
  const tuning = createTuning();
  tuning.run.playerHull = 500; // a random bot would otherwise lose before the jumps matter
  tuning.fighter.waveDelay = 1;
  const world = createWorld(11, tuning);
  enterStartScreen(world);
  const rng = createRng(5);

  for (const target of jumpTargets(tuning.run.battleCount)) {
    devJumpTo(world, target);
    check(world);
    if (world.run.phase === 'battle') {
      devNextWave(world);
      for (const entry of SPAWN_REGISTRY) spawnAhead(world, entry, 3);
      fly(world, rng, 240);
      expect(world.run.phase).toBe('battle');
    } else {
      fly(world, rng, 30); // a menu: the world holds still
    }
  }

  // Jump back into a battle, clear it and let the real flow carry on to a finished run.
  for (let n = 1; n <= tuning.run.battleCount; n++) {
    devJumpTo(world, { kind: 'battle', n });
    fly(world, rng, 60);
    devClearBattle(world);
    fly(world, rng, 60 * (tuning.capital.deathChainTime + 1)); // the capital ship's death chain takes a few seconds
    expect(['debrief', 'end']).toContain(world.run.phase);
  }
  expect(world.run).toMatchObject({ phase: 'end', result: 'victory' });
});

it('clearing a battle with Next wave, then spawns, never ends it early', () => {
  const tuning = createTuning();
  tuning.run.playerHull = 500;
  const world = createWorld(2, tuning);
  enterStartScreen(world);
  devJumpTo(world, { kind: 'battle', n: 1 });
  devNextWave(world);
  const fighter = SPAWN_REGISTRY.find((e) => e.id === 'fighter')!;
  spawnAhead(world, fighter, 5);
  for (let i = 0; i < 120; i++) stepWorld(world, DT);
  expect(world.run.phase).toBe('battle');
  devClearBattle(world);
  for (let i = 0; i < 10; i++) stepWorld(world, DT);
  expect(world.run.phase).toBe('debrief');
});
