import { expect, it } from 'vitest';
import { createTuning } from '../../data/tuning';
import { createRng } from '../../src/core/rng/rng';
import { hashWorld } from '../../src/core/replay/hash';
import { applyFinishedRun, veteranOffers } from '../../src/core/meta/meta';
import { enterStartScreen, offerVeterans, menuRows } from '../../src/core/run/run';
import { createWorld, stepWorld, type World } from '../../src/core/world/world';

const DT = 1 / 60;
const MAX_STEPS = 20 * 60 * 60; // twenty simulated minutes: a run must end well before this

/**
 * A scripted bot: random flight and fire in battle, random menu presses (selecting often) in menus.
 * A bot that flies at random always loses, so an `assist` bot has a big hull and every eight seconds
 * its shots happen to destroy the fighters on the field: that walks a whole run through every phase.
 */
function playRun(
  seed: number,
  assist = false,
): { world: World; steps: number; phases: Set<string> } {
  const world = createWorld(seed, createTuning());
  if (assist) world.tuning.run.playerHull = 500;
  world.tuning.fighter.waveDelay = 2;
  enterStartScreen(world);
  offerVeterans(world, [
    { id: 1, name: 'Old Hand', trait: 'steady', kills: 9 },
    { id: 2, name: 'Ace Mover', trait: 'bold', kills: 4 },
  ]);
  const rng = createRng(seed + 99);
  const a = world.actions;
  const phases = new Set<string>();
  let steps = 0;
  while (world.run.phase !== 'end' && steps < MAX_STEPS) {
    steps++;
    phases.add(world.run.phase);
    if (world.run.phase === 'battle') {
      if (steps % 20 === 0) {
        a.steerX = rng.range(-1, 1);
        a.steerY = rng.range(-1, 1);
        a.throttle = rng.range(-0.5, 1);
        a.fire = rng.next() < 0.8;
        a.evade = rng.next() < 0.1;
        a.launch = rng.next() < 0.05;
      }
      if (assist && steps % 480 === 0) for (const f of world.fighters) f.hp = 0;
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
    stepWorld(world, DT);
    const { ship, run } = world;
    if (!Number.isFinite(ship.x + ship.y + ship.speed)) throw new Error('NaN ship');
    if (run.phase !== 'battle' && (run.cursor < 0 || run.cursor >= menuRows(run)))
      throw new Error('cursor out of range');
    if (run.hull < 0 || run.hull > world.tuning.run.playerHull)
      throw new Error('hull out of range');
    if (world.bullets.count > world.bullets.capacity) throw new Error('bullet pool over cap');
    if (world.missiles.count > world.missiles.capacity) throw new Error('missile pool over cap');
    if (
      world.pilots.roster.filter((p) => p.status === 'active').length > world.tuning.pilots.squadMax
    )
      throw new Error('squad over cap');
  }
  return { world, steps, phases };
}

it.each([1, 2, 3, 4, 5, 6])(
  'a scripted bot finishes a whole run (seed %i): it always ends',
  (seed) => {
    const { world, steps, phases } = playRun(seed, seed > 3);
    expect(world.run.phase, `still in ${world.run.phase} after ${steps} steps`).toBe('end');
    expect(['victory', 'defeat']).toContain(world.run.result);
    expect(phases.has('start') && phases.has('battle')).toBe(true);
    if (world.run.result === 'victory') {
      expect(world.run.battle).toBe(world.tuning.run.battleCount);
      expect(phases.has('debrief')).toBe(true);
    }
  },
);

it('an assisted bot wins a whole run through every phase', () => {
  const { world, phases } = playRun(5, true);
  expect(world.run).toMatchObject({ phase: 'end', result: 'victory' });
  expect(world.run.battle).toBe(world.tuning.run.battleCount);
  expect([...phases].sort()).toEqual(['battle', 'debrief', 'start']);
});

it('a won run saves its survivors, and the next run can bring them back', () => {
  const { world } = playRun(5, true);
  const cap = world.tuning.pilots.veteranCap;
  const meta = applyFinishedRun(
    { veterans: [], bestRun: null },
    world.pilots.roster,
    world.run,
    cap,
  );
  const survivors = world.pilots.roster.filter((p) => p.status === 'active');
  expect(meta.bestRun).toBe(world.tuning.run.battleCount);
  expect(meta.veterans.map((v) => v.name)).toEqual(survivors.map((p) => p.name));

  // A new run on the same save: tick the first veteran on the Start screen and press Start.
  const next = createWorld(77, createTuning());
  enterStartScreen(next);
  offerVeterans(next, veteranOffers(meta));
  for (const button of ['menuSelect', 'menuUp', 'menuSelect'] as const) {
    next.actions[button] = true;
    stepWorld(next, DT);
    next.actions[button] = false;
    stepWorld(next, DT);
  }
  expect(meta.veterans.length).toBeGreaterThan(0);
  expect(next.run.phase).toBe('battle');
  expect(next.pilots.roster[0]).toMatchObject({ veteran: true, veteranId: meta.veterans[0]!.id });
});

it('a whole run, menu choices included, is deterministic', () => {
  expect(hashWorld(playRun(3).world)).toBe(hashWorld(playRun(3).world));
  expect(hashWorld(playRun(3).world)).not.toBe(hashWorld(playRun(4).world));
});
