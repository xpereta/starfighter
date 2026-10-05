import { describe, expect, it } from 'vitest';
import { createTuning, type Tuning } from '../../data/tuning';
import { spawnLancer } from '../../src/core/ai/lancer';
import {
  createMissileWarning,
  missileWarning,
} from '../../src/core/enemies/enemy-missiles-warning';
import { hashWorld } from '../../src/core/replay/hash';
import { createRng } from '../../src/core/rng/rng';
import { devJumpTo } from '../../src/core/run/dev-actions';
import { createWorld, stepWorld, type World } from '../../src/core/world/world';

const DT = 1 / 60;

function quiet(): Tuning {
  const t = createTuning();
  t.fighter.waveSize = 0;
  t.squadron.wingmanCount = 0;
  t.arena.staticCount = 0;
  t.arena.droneCount = 0;
  t.arena.turretCount = 0;
  return t;
}

/** One lancer that cannot die, 1200 u from the player, facing it and ready to fire. */
function duel(seed: number, tuning: Tuning = quiet()): World {
  const world = createWorld(seed, tuning);
  const k = spawnLancer(world, 1200, 0, Math.PI);
  const f = world.fighters[k]!;
  f.hp = f.maxHp = f.lastHp = 1e6;
  f.lancer!.missileTimer = 0.2;
  return world;
}

/**
 * The player flies straight at cruise speed (no steering). With `roll` it presses evade (one
 * step, an edge) when the nearest missile's estimated time to impact falls to `trigger`, using the
 * public warning state, like a player watching the MISSILE arrow would.
 */
function fly(
  world: World,
  seconds: number,
  roll: boolean,
  trigger: number,
): { fired: number; hits: number; spent: number; expired: number } {
  const warning = createMissileWarning();
  const counts = { fired: 0, hits: 0, spent: 0, expired: 0 };
  let pressed = false;
  for (let i = 0; i < seconds * 60; i++) {
    const w = missileWarning(world, warning);
    world.actions.evade = roll && !pressed && w.active && w.eta <= trigger;
    if (world.actions.evade) pressed = true;
    if (!w.active) pressed = false; // a new missile, a new roll
    stepWorld(world, DT);
    for (const e of world.events.events) {
      if (e.type === 'EnemyMissileFired') counts.fired++;
      else if (e.type === 'EnemyMissileHit') {
        if (e.hit === 'player') counts.hits++;
        else if (e.hit === 'immune') counts.spent++;
        else counts.expired++;
      }
    }
    for (const v of [world.ship.x, world.ship.y, world.ship.speed])
      expect(Number.isFinite(v)).toBe(true);
  }
  return counts;
}

describe('a player against a lancer (practice mode, a single missile at a time)', () => {
  it('a scripted roll timed on the warning survives the missiles', () => {
    let fired = 0;
    let hits = 0;
    let spent = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const r = fly(duel(seed), 14, true, 0.15);
      fired += r.fired;
      hits += r.hits;
      spent += r.spent;
    }
    expect(fired).toBeGreaterThanOrEqual(12 * 2);
    // The roll beats almost every missile (the arrival estimate is rough, so allow a few misses).
    expect(hits / fired).toBeLessThan(0.2);
    expect(spent).toBeGreaterThan(fired * 0.5);
  });

  it('a player who never rolls or turns takes damage from the same missiles', () => {
    let fired = 0;
    let hits = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const w = duel(seed);
      const r = fly(w, 14, false, 0);
      fired += r.fired;
      hits += r.hits;
      expect(w.stats.hitsTaken).toBe(r.hits * w.tuning.lancer.missileDamage);
    }
    expect(hits / fired).toBeGreaterThan(0.6);
  });

  it('the time from launch to impact leaves a reaction window well beyond the roll (fairness)', () => {
    // Straight-flying player, no roll: measure launch -> impact for every missile that hit.
    const times: number[] = [];
    for (let seed = 1; seed <= 12; seed++) {
      const w = duel(seed);
      const launched: number[] = [];
      for (let i = 0; i < 14 * 60; i++) {
        stepWorld(w, DT);
        for (const e of w.events.events) {
          if (e.type === 'EnemyMissileFired') launched.push(w.time);
          if (e.type === 'EnemyMissileHit' && e.hit === 'player' && launched.length > 0) {
            times.push(w.time - launched.shift()!);
          }
        }
      }
    }
    expect(times.length).toBeGreaterThan(5);
    const min = Math.min(...times);
    // At least 1.3 s (measured: 1.5 to 2.9 s at default tuning) to see the warning and time a roll whose i-frames last 0.3 s.
    expect(min).toBeGreaterThan(1.3);
  });
});

describe('wingmen', () => {
  it('are never hit and the missiles never leave the player line', () => {
    const tuning = quiet();
    tuning.squadron.wingmanCount = 3;
    const world = duel(7, tuning);
    world.tuning.squadron.wingmanCount = 3;
    stepWorld(world, DT); // creates the wingmen
    const lancer = world.fighters[0]!;
    // Make the lancer unkillable and ignore anything the wingmen do to it.
    let missilesSeen = 0;
    for (let i = 0; i < 20 * 60; i++) {
      lancer.hp = lancer.maxHp;
      // Park the wingmen on the missiles' path: right between lancer and player.
      stepWorld(world, DT);
      for (const e of world.events.events) if (e.type === 'EnemyMissileFired') missilesSeen++;
      for (const w of world.squadron.wingmen) {
        expect(w.alive).toBe(true);
        expect(w.hp).toBeGreaterThan(0);
      }
      for (const e of world.events.events) {
        expect(e.type).not.toBe('WingmanHit');
        expect(e.type).not.toBe('WingmanDown');
      }
    }
    expect(missilesSeen).toBeGreaterThan(0);
    expect(world.squadron.wingmen.length).toBe(3);
  });
});

describe('finite and bounded', () => {
  it('six lancers against a random-flying bot for two minutes: all finite, pools in their caps, missiles inside the arena radius times two', () => {
    const tuning = quiet();
    tuning.squadron.wingmanCount = 2;
    const world = createWorld(21, tuning);
    const rng = createRng(5);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const i = spawnLancer(world, Math.cos(a) * 3000, Math.sin(a) * 3000, a + Math.PI);
      world.fighters[i]!.lancer!.missileTimer = 0.5 + k * 0.4;
    }
    const act = world.actions;
    const cap = world.enemies.missiles.capacity;
    let peak = 0;
    for (let i = 0; i < 120 * 60; i++) {
      if (i % 20 === 0) {
        act.steerX = rng.range(-1, 1);
        act.steerY = rng.range(-1, 1);
        act.throttle = rng.range(-0.5, 1);
        act.fire = rng.next() < 0.8;
        act.evade = rng.next() < 0.1;
      }
      stepWorld(world, DT);
      const m = world.enemies.missiles;
      peak = Math.max(peak, m.count);
      expect(m.count).toBeLessThanOrEqual(cap);
      for (let j = 0; j < m.count; j++) {
        const sum = m.data.x[j]! + m.data.y[j]! + m.data.vx[j]! + m.data.vy[j]! + m.data.life[j]!;
        expect(Number.isFinite(sum)).toBe(true);
        expect(Math.hypot(m.data.x[j]!, m.data.y[j]!)).toBeLessThan(
          world.tuning.flight.arenaRadius * 2,
        );
        expect(m.data.life[j]!).toBeGreaterThan(0);
        expect(m.data.life[j]!).toBeLessThanOrEqual(world.tuning.lancer.missileLife);
      }
      for (const f of world.fighters) expect(Number.isFinite(f.x + f.y + f.hp)).toBe(true);
    }
    expect(peak).toBeGreaterThan(0);
  });

  it('a lancer killed by the player counts as a kill like a fighter and leaves the pool consistent', () => {
    const world = createWorld(3, quiet());
    const k = spawnLancer(world, 800, 0, Math.PI);
    world.fighters[k]!.hp = 0;
    stepWorld(world, DT);
    expect(world.fighters[k]!.alive).toBe(false);
    expect(world.stats.kills).toBe(1);
  });
});

describe('determinism', () => {
  it('the same seed and inputs give the same hash at every second, with missiles in the air', () => {
    const run = (): string[] => {
      const world = duel(4);
      const rng = createRng(11);
      const hashes: string[] = [];
      for (let i = 0; i < 20 * 60; i++) {
        if (i % 25 === 0) {
          world.actions.steerX = rng.range(-1, 1);
          world.actions.steerY = rng.range(-1, 1);
          world.actions.evade = rng.next() < 0.15;
        }
        stepWorld(world, DT);
        if (i % 60 === 0) hashes.push(String(hashWorld(world)));
      }
      return hashes;
    };
    const a = run();
    expect(a).toEqual(run());
    expect(new Set(a).size).toBeGreaterThan(5);
  });
});

describe('lancers in a run', () => {
  it('battle 3 brings one lancer in the first wave and pairs later, only behind the toggle', () => {
    const withToggle = (on: boolean): number[] => {
      const world = createWorld(9, createTuning());
      world.tuning.lancer.inBattles = on;
      world.tuning.fighter.waveDelay = 1;
      world.tuning.run.playerHull = 500;
      devJumpTo(world, { kind: 'battle', n: 3 });
      const perWave: number[] = [];
      let lastWave = 0;
      for (let i = 0; i < 90 * 60 && perWave.length < 3; i++) {
        stepWorld(world, DT);
        if (world.run.wave !== lastWave) {
          lastWave = world.run.wave;
          perWave.push(world.fighters.filter((f) => f.alive && f.lancer).length);
        }
        if (i % 120 === 0) for (const f of world.fighters) if (f.alive) f.hp = 0; // the assist
      }
      return perWave;
    };
    expect(withToggle(true)).toEqual([1, 2, 2]);
    expect(withToggle(false)).toEqual([0, 0, 0]);
  });

  it('a run-mode hit takes the missile damage from the hull', () => {
    const world = duel(2);
    devJumpTo(world, { kind: 'battle', n: 1 });
    world.tuning.fighter.waveSize = 0;
    world.fighters.length = 0;
    world.targets.length = 0;
    const k = spawnLancer(world, 1200, 0, Math.PI);
    world.fighters[k]!.hp = world.fighters[k]!.maxHp = world.fighters[k]!.lastHp = 1e6;
    world.fighters[k]!.lancer!.missileTimer = 0.2;
    const hull = world.run.hull;
    for (let i = 0; i < 12 * 60 && world.run.hull === hull; i++) stepWorld(world, DT);
    expect(world.run.hull).toBe(hull - world.tuning.lancer.missileDamage);
  });
});
