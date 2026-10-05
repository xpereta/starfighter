import { describe, expect, it } from 'vitest';
import { createTuning, type Tuning } from '../../data/tuning';
import { spawnFighter } from '../../src/core/ai/waves';
import { hashWorld } from '../../src/core/replay/hash';
import { createRng } from '../../src/core/rng/rng';
import { createWorld, stepWorld, type World } from '../../src/core/world/world';

const DT = 1 / 60;
const HP = 1000; // far above anything: the fighter never dies, damage tells the outcome

function quietTuning(): Tuning {
  const t = createTuning();
  t.fighter.waveSize = 0;
  t.squadron.wingmanCount = 0;
  t.arena.staticCount = 0;
  t.arena.droneCount = 0;
  t.arena.turretCount = 0;
  return t;
}

/**
 * One shot through the real pipeline: the player sits still at the origin and keeps its nose on
 * one fighter that flies 1300-1800 u away on a random heading; as soon as the lock is acquired
 * it presses launch. With `wingmen` wingmen the salvo has `1 + wingmen` missiles, all assigned to
 * that single lock. The fighter has 1000 hp so it never dies; hits are counted from `MissileImpact`.
 */
function shoot(
  seed: number,
  wingmen: number,
  tweak?: (t: Tuning) => void,
): { launched: number; hits: number; world: World } {
  const tuning = quietTuning();
  tuning.squadron.wingmanCount = wingmen;
  tweak?.(tuning);
  const world = createWorld(seed, tuning);
  const rng = createRng(seed * 7 + 1);
  const ship = world.ship;
  ship.vx = 0;
  ship.vy = 0;
  ship.speed = 0;
  const bearing = rng.range(-0.5, 0.5);
  const dist = rng.range(1300, 1800);
  const k = spawnFighter(
    world,
    Math.cos(bearing) * dist,
    Math.sin(bearing) * dist,
    bearing + Math.PI + rng.range(-1.2, 1.2),
    5,
  );
  const f = world.fighters[k]!;
  f.hp = f.maxHp = f.lastHp = HP;
  let launched = 0;
  let hits = 0;
  let pressed = false;
  for (let i = 0; i < 12 * 60; i++) {
    ship.heading = Math.atan2(f.y - ship.y, f.x - ship.x); // keep the nose on it
    ship.omega = 0;
    world.actions.launch = !pressed && world.lockon.locks.length > 0;
    if (world.actions.launch) pressed = true;
    stepWorld(world, DT);
    for (const e of world.events.events) {
      if (e.type === 'MissileLaunched') launched++;
      else if (e.type === 'MissileImpact') hits++;
    }
    const m = world.missiles;
    let sum = f.x + f.y + f.vx + f.vy + f.ship.heading + f.ship.speed + f.hp;
    for (let j = 0; j < m.count; j++)
      sum += m.data.x[j]! + m.data.y[j]! + m.data.heading[j]! + m.data.speed[j]!;
    expect(Number.isFinite(sum)).toBe(true);
    if (pressed && m.count === 0 && m.salvo.pending.length === 0) break;
  }
  expect(world.missiles.count).toBe(0); // every missile hit, passed or burnt out: nothing stuck
  return { launched, hits, world };
}

/** Fraction of launched missiles that did not hit, over `shots` shots with `wingmen` wingmen. */
function evadedFraction(shots: number, wingmen: number, tweak?: (t: Tuning) => void): number {
  let launched = 0;
  let hits = 0;
  for (let s = 1; s <= shots; s++) {
    const r = shoot(s, wingmen, tweak);
    expect(r.launched).toBe(1 + wingmen);
    launched += r.launched;
    hits += r.hits;
  }
  return 1 - hits / launched;
}

describe('fighters evade missiles (default tuning)', () => {
  it('a single missile is evaded roughly a third of the time (band 25-50%)', () => {
    const rate = evadedFraction(300, 0);
    expect(rate).toBeGreaterThan(0.25);
    expect(rate).toBeLessThan(0.55);
  });

  it('a salvo of four at one fighter mostly lands, and never gets fully dodged', () => {
    let missiles = 0;
    let hits = 0;
    let dodgedAll = 0;
    for (let s = 1; s <= 200; s++) {
      const r = shoot(s, 3);
      missiles += r.launched;
      hits += r.hits;
      if (r.hits === 0) dodgedAll++;
    }
    expect(1 - hits / missiles).toBeLessThan(0.45);
    expect(dodgedAll / 200).toBeLessThan(0.05);
  });

  it('with the toggle off nothing is evaded', () => {
    const rate = evadedFraction(100, 0, (t) => {
      t.fighter.enemiesEvadeMissiles = false;
    });
    expect(rate).toBe(0);
  });

  it('with missileEvadeChance 0 nothing is evaded', () => {
    const rate = evadedFraction(60, 0, (t) => {
      t.fighter.missileEvadeChance = 0;
    });
    expect(rate).toBe(0);
  });

  it('is deterministic: the same shot gives the same hash', () => {
    for (const seed of [3, 9, 21]) {
      expect(hashWorld(shoot(seed, 1).world)).toBe(hashWorld(shoot(seed, 1).world));
    }
  });
});
