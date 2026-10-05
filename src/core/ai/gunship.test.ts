import { describe, expect, it } from 'vitest';
import { createTuning } from '../../../data/tuning';
import { DEG } from '../math';
import { hashWorld } from '../replay/hash';
import { createWingman } from '../squadron/wingmen';
import { FIGHTER_ID_BASE } from '../world/lockable';
import { createWorld, stepWorld, type World } from '../world/world';
import { SHIP_GUNSHIP } from './fighter';
import { stepFighters } from './fighters';
import { spawnGunship, standoffHeading } from './gunship';
import { resolveFighterKills, spawnBattleWave, spawnFighter } from './waves';

const DT = 1 / 60;

/** A world with no waves and a motionless player at the origin, so each test controls the scene. */
function arena(): World {
  const tuning = createTuning();
  tuning.fighter.waveSize = 0;
  const world = createWorld(1, tuning);
  world.ship.vx = 0;
  world.ship.vy = 0;
  return world;
}

/** Runs only the fighter AI (and so the gunship) for `n` steps. */
function aiSteps(world: World, n = 1): void {
  for (let i = 0; i < n; i++) {
    world.tick += 1;
    world.time += DT;
    stepFighters(world);
  }
}

/** A gunship at (x, y) pointing along `heading`, stopped so the geometry stays put. */
function gunshipAt(world: World, x: number, y: number, heading: number): number {
  const i = spawnGunship(world, x, y, heading);
  const g = world.fighters[i]!;
  g.ship.speed = 0;
  return i;
}

describe('spawning', () => {
  it('a gunship has the tuning hull and radius, two mounts, and emits EnemySpawned', () => {
    const world = arena();
    world.tuning.gunship.hull = 9;
    world.tuning.gunship.radius = 55;
    const seen: unknown[] = [];
    const emit = world.events.emit;
    world.events.emit = (e) => {
      seen.push(e);
      emit(e);
    };
    const i = spawnGunship(world, 100, 200, 0.5);
    const g = world.fighters[i]!;
    expect(g).toMatchObject({ hp: 9, maxHp: 9, radius: 55, alive: true, shipType: SHIP_GUNSHIP });
    expect(g.mounts).toHaveLength(2);
    expect(seen).toContainEqual({ type: 'EnemySpawned', kind: 'gunship', x: 100, y: 200 });
  });

  it('is much slower than a fighter and turns slower', () => {
    const world = arena();
    const g = world.fighters[spawnGunship(world, 3000, 0, Math.PI)]!;
    const f = world.fighters[spawnFighter(world, 3000, 500, Math.PI)]!;
    aiSteps(world, 240);
    expect(Math.hypot(g.vx, g.vy)).toBeLessThan(Math.hypot(f.vx, f.vy) * 0.6);
  });

  it('a battle wave of gunships spawns that many, around the edge, with fighters alongside', () => {
    const world = arena();
    spawnBattleWave(world, {
      groups: [
        { kind: 'fighter', count: 3 },
        { kind: 'gunship', count: 2 },
      ],
    });
    expect(world.fighters.filter((f) => f.alive && f.shipType === SHIP_GUNSHIP)).toHaveLength(2);
    expect(world.fighters.filter((f) => f.alive && f.shipType !== SHIP_GUNSHIP)).toHaveLength(3);
  });

  it('a dead slot is reused by a gunship, and its kill is reported as a gunship', () => {
    const world = arena();
    const a = spawnFighter(world, 500, 0, 0);
    world.fighters[a]!.hp = 0;
    resolveFighterKills(world);
    expect(world.fighters[a]!.alive).toBe(false);
    const g = spawnGunship(world, 900, 0, 0);
    expect(g).toBe(a);
    world.fighters[g]!.hp = 0;
    const kinds: string[] = [];
    const emit = world.events.emit;
    world.events.emit = (e) => {
      if (e.type === 'Killed') kinds.push(e.kind);
      emit(e);
    };
    resolveFighterKills(world);
    expect(kinds).toEqual(['gunship']);
    expect(world.stats.kills).toBe(2);
  });

  it('is a lockable, hittable enemy in the shared id space', () => {
    const world = arena();
    const i = spawnGunship(world, 900, 0, 0);
    expect(world.fighters[i]!.radius).toBe(world.tuning.gunship.radius);
    expect(FIGHTER_ID_BASE + i).toBeGreaterThanOrEqual(FIGHTER_ID_BASE);
  });
});

describe('standoff', () => {
  it('standoffHeading: at the standoff it circles broadside, far out it closes, inside it backs off', () => {
    expect(standoffHeading(0, 1, 0)).toBeCloseTo(Math.PI / 2);
    expect(standoffHeading(0, -1, 0)).toBeCloseTo(-Math.PI / 2);
    expect(standoffHeading(0, 1, 1)).toBeCloseTo(0);
    expect(standoffHeading(0, 1, 5)).toBeCloseTo(0); // clamped
    expect(standoffHeading(0, 1, -1)).toBeCloseTo(Math.PI);
  });

  it('closes in from far away and keeps its distance near the standoff instead of ramming', () => {
    const world = arena();
    const g = world.fighters[spawnGunship(world, 3500, 0, Math.PI)]!;
    const standoff = world.tuning.gunship.standoff;
    aiSteps(world, 60 * 40);
    const dist = Math.hypot(g.x, g.y);
    expect(dist).toBeLessThan(2500);
    expect(dist).toBeGreaterThan(standoff * 0.35);
    // And over the next stretch it stays out of ramming range.
    let min = Infinity;
    for (let i = 0; i < 60 * 30; i++) {
      aiSteps(world);
      min = Math.min(min, Math.hypot(g.x, g.y));
    }
    expect(min).toBeGreaterThan(standoff * 0.35);
  });
});

describe('turrets', () => {
  /** Counts the bullets the gunship fires in `seconds`, with the player at (px, py). */
  function shotsAt(
    px: number,
    py: number,
    heading: number,
    seconds = 4,
    setup?: (w: World) => void,
  ): number {
    const world = arena();
    world.ship.x = px;
    world.ship.y = py;
    setup?.(world);
    const i = gunshipAt(world, 0, 0, heading);
    let fired = 0;
    const emit = world.events.emit;
    world.events.emit = (e) => {
      if (e.type === 'EnemyShotFired') fired++;
      emit(e);
    };
    for (let k = 0; k < seconds * 60; k++) {
      const g = world.fighters[i]!;
      // Keep the geometry fixed: the test is about the turrets, not the hull.
      g.ship.x = 0;
      g.ship.y = 0;
      g.ship.heading = heading;
      g.ship.speed = 0;
      g.ship.vx = 0;
      g.ship.vy = 0;
      aiSteps(world);
      world.enemyShots.clear();
    }
    return fired;
  }

  it('shoot a player at its side and ahead', () => {
    expect(shotsAt(400, 0, 0)).toBeGreaterThan(20); // dead ahead (in both arcs)
    expect(shotsAt(0, 400, 0)).toBeGreaterThan(20); // to the left
    expect(shotsAt(0, -400, 0)).toBeGreaterThan(20); // to the right
  });

  it('cannot shoot a player straight behind it: the blind spot', () => {
    expect(shotsAt(-400, 0, 0)).toBe(0);
  });

  it('does not shoot beyond its range', () => {
    const world = arena();
    expect(shotsAt(world.tuning.gunship.turretRange + 300, 0, 0)).toBe(0);
  });

  it('fires in bursts with pauses: a 4 s fight has gaps of about the pause length', () => {
    const world = arena();
    world.ship.x = 400;
    const i = gunshipAt(world, 0, 0, 0);
    const times: number[] = [];
    const emit = world.events.emit;
    world.events.emit = (e) => {
      if (e.type === 'EnemyShotFired') times.push(world.time);
      emit(e);
    };
    for (let k = 0; k < 60 * 8; k++) {
      const g = world.fighters[i]!;
      g.ship.x = 0;
      g.ship.y = 0;
      g.ship.heading = 0;
      g.ship.speed = 0;
      aiSteps(world);
      world.enemyShots.clear();
    }
    let longest = 0;
    for (let k = 1; k < times.length; k++) longest = Math.max(longest, times[k]! - times[k - 1]!);
    expect(longest).toBeGreaterThan(world.tuning.gunship.turretBurstPause * 0.8);
    expect(times.length).toBeGreaterThan(50);
  });

  it('shoots a wingman when the player is out of its arcs or range', () => {
    const behindPlayer = shotsAt(-400, 0, 0, 3, (w) => {
      const wing = createWingman(w, 0, 1);
      wing.ship.x = 400;
      wing.ship.y = 100;
      wing.ship.vx = 0;
      wing.ship.vy = 0;
      w.squadron.wingmen.push(wing);
    });
    expect(behindPlayer).toBeGreaterThan(20);
  });

  it('prefers the player when both are in reach', () => {
    const world = arena();
    world.ship.x = 400;
    const wing = createWingman(world, 0, 1);
    wing.ship.x = 300;
    wing.ship.y = 300;
    wing.ship.vx = 0;
    wing.ship.vy = 0;
    world.squadron.wingmen.push(wing);
    const i = gunshipAt(world, 0, 0, 0);
    const angles: number[] = [];
    const emit = world.events.emit;
    world.events.emit = (e) => {
      if (e.type === 'EnemyShotFired') angles.push(e.angle);
      emit(e);
    };
    for (let k = 0; k < 120; k++) {
      const g = world.fighters[i]!;
      g.ship.x = 0;
      g.ship.y = 0;
      g.ship.heading = 0;
      g.ship.speed = 0;
      aiSteps(world);
      world.enemyShots.clear();
    }
    expect(angles.length).toBeGreaterThan(5);
    // The player is dead ahead: every shot is within the spread (plus a little for the turret offset) of 0.
    for (const a of angles) expect(Math.abs(a)).toBeLessThan(25 * DEG);
  });

  it('turret bullets go into the shared enemy shot pool and hit a player who sits still', () => {
    const world = createWorld(3, createTuning());
    world.tuning.fighter.waveSize = 0;
    spawnGunship(world, 500, 0, Math.PI);
    let maxShots = 0;
    for (let k = 0; k < 60 * 8; k++) {
      world.actions.throttle = -1;
      stepWorld(world, DT);
      maxShots = Math.max(maxShots, world.enemyShots.count);
    }
    expect(maxShots).toBeGreaterThan(0);
    expect(world.stats.hitsTaken).toBeGreaterThan(0);
  });

  it('is deterministic: the same scene twice gives the same hash', () => {
    const run = (): string => {
      const world = createWorld(5, createTuning());
      world.tuning.fighter.waveSize = 0;
      spawnGunship(world, 1500, 300, Math.PI);
      for (let k = 0; k < 60 * 10; k++) stepWorld(world, DT);
      return hashWorld(world);
    };
    expect(run()).toBe(run());
  });
});
