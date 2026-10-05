import { expect, it } from 'vitest';
import { createTuning } from '../../data/tuning';
import { hashWorld } from '../../src/core/replay/hash';
import { addPilot, findPilot } from '../../src/core/pilots/pilots';
import { createRng } from '../../src/core/rng/rng';
import { createWorld, stepWorld } from '../../src/core/world/world';

const DT = 1 / 60;
const TRAITS = ['sharpshooter', 'steady', 'bold', 'guardian'] as const;

/** A run-mode world with a full 4-pilot squad flying 120 s of seeded random play against waves. */
function play(seed: number) {
  const tuning = createTuning();
  tuning.arena.staticCount = 0;
  tuning.arena.droneCount = 0;
  tuning.arena.turretCount = 0;
  const world = createWorld(seed, tuning);
  world.run.mode = 'run';
  TRAITS.forEach((trait, i) => addPilot(world, { name: `Pilot ${i}`, trait }, 'pick'));
  const rng = createRng(seed + 1000);
  const a = world.actions;
  let lost = 0;
  let kills = 0;
  for (let i = 0; i < 120 * 60; i++) {
    if (i % 20 === 0) {
      a.steerX = rng.range(-1, 1);
      a.steerY = rng.range(-1, 1);
      a.throttle = rng.range(-0.5, 1);
      a.fire = rng.next() < 0.8;
    }
    stepWorld(world, DT);
    for (const e of world.events.events) {
      if (e.type === 'PilotLost') lost++;
      else if (e.type === 'PilotKill') kills++;
    }

    const { ship } = world;
    expect(Number.isFinite(ship.x + ship.y + ship.speed)).toBe(true);
    // No pilot is both alive and lost: an active pilot flies a living wingman, a lost one does not.
    for (const p of world.pilots.roster) {
      const wingman = world.squadron.wingmen.find((w) => w.pilotId === p.id);
      expect(wingman, `pilot ${p.id} has a wingman`).toBeDefined();
      expect(p.status === 'active', `pilot ${p.id} status matches its wingman`).toBe(
        wingman!.alive,
      );
      if (wingman!.alive) {
        expect(Number.isFinite(wingman!.ship.x + wingman!.ship.y + wingman!.hp)).toBe(true);
      }
    }
    expect(world.squadron.wingmen).toHaveLength(4); // never grows past the squad, lost entries stay
    expect(world.bullets.count).toBeLessThanOrEqual(world.bullets.capacity);
    expect(world.missiles.count).toBeLessThanOrEqual(world.missiles.capacity);
  }
  return { world, lost, kills };
}

it('120 s with a 4-pilot squad: no NaN, no pilot both alive and lost, pools within caps', () => {
  const { world, lost } = play(31);
  expect(world.pilots.roster).toHaveLength(4);
  // A lost pilot stays lost for the rest of the run.
  for (const p of world.pilots.roster) {
    const wingman = world.squadron.wingmen.find((w) => w.pilotId === p.id)!;
    if (p.status === 'lost') expect(wingman.alive).toBe(false);
  }
  expect(lost).toBe(world.pilots.roster.filter((p) => p.status === 'lost').length);
});

it('pilot kills are credited to pilots that exist, and never more than the enemies killed', () => {
  const { world, kills } = play(47);
  const credited = world.pilots.roster.reduce((sum, p) => sum + p.kills, 0);
  expect(credited).toBe(kills);
  expect(credited).toBeLessThanOrEqual(world.stats.kills);
  expect(findPilot(world.pilots, 1)).toBeDefined();
});

it('is deterministic: the same seed and inputs give the same final state', () => {
  expect(hashWorld(play(5).world)).toBe(hashWorld(play(5).world));
});
