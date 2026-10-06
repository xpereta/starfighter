import { describe, expect, it } from 'vitest';
import { createTuning } from '../../../data/tuning';
import { createWorld, stepWorld, type World } from '../world/world';
import { spawnBattleWave, spawnFighter, stepWaves } from './waves';

const DT = 1 / 60;

function worldWith(waveSize = 4, waveDelay = 6): World {
  const tuning = createTuning();
  tuning.fighter.waveSize = waveSize;
  tuning.fighter.waveDelay = waveDelay;
  return createWorld(5, tuning);
}

/** Steps the whole world (everything runs; the player flies straight and does not shoot). */
function steps(world: World, seconds: number): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) stepWorld(world, DT);
}

function killAll(world: World): void {
  for (const f of world.fighters) f.hp = 0;
  stepWaves(world);
}

const living = (world: World): number => world.fighters.filter((f) => f.alive).length;

describe('waves', () => {
  it('the first wave arrives straight away: waveSize fighters around the arena edge, heading inward', () => {
    const world = worldWith(4);
    expect(world.fighters).toHaveLength(0);
    steps(world, DT);
    expect(world.fighters).toHaveLength(4);
    const ring = world.tuning.flight.arenaRadius * world.tuning.fighter.spawnFraction;
    for (const f of world.fighters) {
      expect(f.alive).toBe(true);
      // They have moved at most one step from the spawn ring.
      expect(Math.hypot(f.x, f.y)).toBeGreaterThan(ring - 20);
      expect(Math.hypot(f.x, f.y)).toBeLessThan(ring + 20);
    }
    // Spread around the circle, not stacked.
    const angles = world.fighters.map((f) => Math.atan2(f.y, f.x)).sort((a, b) => a - b);
    for (let i = 1; i < angles.length; i++)
      expect(angles[i]! - angles[i - 1]!).toBeGreaterThan(0.5);
  });

  it('waveSize 0 turns waves off', () => {
    const world = worldWith(0);
    steps(world, 20);
    expect(world.fighters).toHaveLength(0);
  });

  it('waits waveDelay after the last fighter dies, then sends the next wave', () => {
    const world = worldWith(4, 6);
    steps(world, DT);
    killAll(world);
    expect(living(world)).toBe(0);
    steps(world, 5.5);
    expect(living(world)).toBe(0); // still waiting
    steps(world, 1);
    expect(living(world)).toBe(4);
  });

  it('does not send a wave while any fighter is still alive', () => {
    const world = worldWith(4, 1);
    steps(world, DT);
    for (const f of world.fighters.slice(0, 3)) f.hp = 0;
    stepWaves(world);
    steps(world, 10);
    expect(living(world)).toBeLessThanOrEqual(1 + 0); // the survivor may even die in the dogfight
    expect(world.fighters).toHaveLength(4);
  });

  it('reuses dead slots, so ids stay stable and the array does not grow', () => {
    const world = worldWith(4, 1);
    steps(world, DT);
    for (let wave = 0; wave < 5; wave++) {
      killAll(world);
      steps(world, 1.5);
      expect(living(world)).toBe(4);
      expect(world.fighters).toHaveLength(4);
    }
  });

  it('a bigger waveSize adds slots; spawnFighter fills the first dead slot', () => {
    const world = worldWith(2, 1);
    steps(world, DT);
    killAll(world);
    world.tuning.fighter.waveSize = 3;
    steps(world, 1.5);
    expect(living(world)).toBe(3);
    expect(world.fighters).toHaveLength(3);
    world.fighters[1]!.alive = false;
    expect(spawnFighter(world, 0, 0, 0)).toBe(1);
  });

  it('a respawn clears the fighters and the next step brings a fresh wave', () => {
    const world = worldWith(4, 6);
    steps(world, 2);
    world.actions.respawn = true;
    stepWorld(world, DT);
    world.actions.respawn = false;
    expect(living(world)).toBe(4);
    for (const f of world.fighters) {
      const ring = world.tuning.flight.arenaRadius * world.tuning.fighter.spawnFraction;
      expect(Math.hypot(f.x, f.y)).toBeGreaterThan(ring - 20);
    }
  });

  it('counts each kill once in the stats', () => {
    const world = worldWith(4, 6);
    steps(world, DT);
    const before = world.stats.kills;
    killAll(world);
    stepWaves(world);
    expect(world.stats.kills).toBe(before + 4);
  });
});

describe('battle wave groups', () => {
  it('a lancer group spawns that many missile fighters, a sized wing that many fighters', () => {
    const world = worldWith(0);
    spawnBattleWave(world, { groups: [{ kind: 'lancer', count: 2 }] });
    expect(world.fighters.filter((f) => f.alive && f.lancer)).toHaveLength(2);
    const before = living(world);
    spawnBattleWave(world, { groups: [{ kind: 'wing', count: 1, size: 3 }] });
    expect(living(world) - before).toBe(3);
    expect(world.enemies.wings).toHaveLength(1);
  });
});
