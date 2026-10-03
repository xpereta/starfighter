import { describe, expect, it } from 'vitest';
import { createTuning } from '../../../data/tuning';
import { hashWorld } from '../replay/hash';
import type { Fighter } from '../ai/fighters';
import { createShip } from '../flight/flight';
import type { Wingman } from '../squadron/squadron';
import { DEG } from '../math';
import type { Target } from '../world/target';
import { FIGHTER_ID_BASE } from '../world/lockable';
import { createWorld, stepWorld, type World } from '../world/world';
import { angleOffNose, createLockOn, lockLimit, stepLockOn } from './lockon';

const DT = 1 / 60;

function target(x: number, y: number, radius = 30): Target {
  return {
    kind: 'drone',
    mode: 'static',
    x,
    y,
    radius,
    hp: 3,
    maxHp: 3,
    alive: true,
    homeX: x,
    homeY: y,
    vx: 0,
    vy: 0,
    angle: 0,
    speed: 0,
    orbitX: 0,
    orbitY: 0,
    orbitRadius: 0,
    omega: 0,
    cooldown: 0,
    respawnTimer: 0,
  };
}

/** A world with no arena targets, the ship at the origin pointing along +x. */
function setup(): World {
  const world = createWorld(1, createTuning());
  world.targets.length = 0;
  return world;
}

function addWingmen(world: World, count: number): void {
  for (let i = 0; i < count; i++) {
    world.squadron.wingmen.push({
      ship: createShip(world.tuning.flight),
      hp: 3,
      alive: true,
    } as Wingman);
  }
}

function run(world: World, seconds: number): void {
  const events = world.events;
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    events.clear();
    stepLockOn(world);
  }
}

const types = (world: World): string[] => world.events.events.map((e) => e.type);

describe('cone geometry', () => {
  it('angleOffNose is zero inside a body and shrinks by the body angular size', () => {
    expect(angleOffNose(0, 0, 0, 10, 0, 30)).toBe(0);
    expect(angleOffNose(0, 0, 0, 1000, 0, 100)).toBe(0);
    const bare = angleOffNose(0, 0, 0, 800, 800, 0);
    expect(bare).toBeCloseTo(45 * DEG);
    expect(angleOffNose(0, 0, 0, 800, 800, 100)).toBeLessThan(bare);
  });

  it('acquires a target inside the cone and ignores one outside it', () => {
    const w = setup();
    const half = w.tuning.lockon.coneHalfAngle * DEG;
    w.targets.push(target(800, 800 * Math.tan(half * 0.8), 0)); // inside
    w.targets.push(target(800, -800 * Math.tan(half * 1.4), 0)); // outside
    run(w, DT);
    expect(w.lockon.acquiringId).toBe(0);
  });

  it('respects the maximum range', () => {
    const w = setup();
    w.targets.push(target(w.tuning.lockon.lockRange + 200, 0, 30));
    run(w, DT);
    expect(w.lockon.acquiringId).toBe(-1);
    w.targets[0]!.x = w.tuning.lockon.lockRange; // within range once the radius counts
    run(w, DT);
    expect(w.lockon.acquiringId).toBe(0);
  });

  it('turns with the nose', () => {
    const w = setup();
    w.targets.push(target(0, 800, 20)); // straight up
    run(w, DT);
    expect(w.lockon.acquiringId).toBe(-1);
    w.ship.heading = Math.PI / 2;
    run(w, DT);
    expect(w.lockon.acquiringId).toBe(0);
  });
});

describe('acquisition', () => {
  it('picks the candidate nearest the nose axis, ties by lower id', () => {
    const w = setup();
    w.targets.push(target(800, 90, 0)); // off axis
    w.targets.push(target(800, 20, 0)); // nearest
    w.targets.push(target(800, 60, 0));
    run(w, DT);
    expect(w.lockon.acquiringId).toBe(1);

    const tie = setup();
    tie.targets.push(target(800, 50, 0));
    tie.targets.push(target(800, -50, 0)); // same angle, other side
    run(tie, DT);
    expect(tie.lockon.acquiringId).toBe(0);
  });

  it('fills over lockTime, then becomes a lock and the next target starts filling', () => {
    const w = setup();
    w.targets.push(target(800, 0, 20));
    w.targets.push(target(900, 40, 20));
    addWingmen(w, 2);
    run(w, w.tuning.lockon.lockTime / 2);
    expect(w.lockon.locks).toEqual([]);
    expect(w.lockon.progress).toBeGreaterThan(0.3);
    expect(w.lockon.progress).toBeLessThan(w.tuning.lockon.lockTime);

    const all: string[] = [];
    for (let i = 0; i < 60; i++) {
      w.events.clear();
      stepLockOn(w);
      all.push(...types(w));
    }
    expect(w.lockon.locks[0]).toBe(0);
    expect(all).toContain('LockAcquired');
    expect(all).toContain('LockAcquiring'); // the second target
    expect(w.lockon.acquiringId).toBe(1);
    run(w, w.tuning.lockon.lockTime + 0.1);
    expect(w.lockon.locks).toEqual([0, 1]); // acquisition order
  });

  it('emits LockAcquiring then LockAcquired once for a single target', () => {
    const w = setup();
    w.targets.push(target(800, 0, 20));
    const all: string[] = [];
    for (let i = 0; i < 90; i++) {
      w.events.clear();
      stepLockOn(w);
      all.push(...types(w));
    }
    expect(all).toEqual(['LockAcquiring', 'LockAcquired']);
  });

  it('locks fighters through the shared id space and never targets an id already locked', () => {
    const w = setup();
    w.fighters.push({ x: 600, y: 0, vx: 0, vy: 0, radius: 28, hp: 3, alive: true } as Fighter);
    addWingmen(w, 1);
    run(w, w.tuning.lockon.lockTime + 0.1);
    expect(w.lockon.locks).toEqual([FIGHTER_ID_BASE]);
    run(w, 2);
    expect(w.lockon.locks).toEqual([FIGHTER_ID_BASE]); // not locked twice
    expect(w.lockon.acquiringId).toBe(-1);
  });
});

describe('lock limit', () => {
  const targetsInCone = (w: World, n: number): void => {
    for (let i = 0; i < n; i++) w.targets.push(target(700 + i * 40, (i - n / 2) * 8, 20));
  };

  it.each([
    [0, 1],
    [1, 2],
    [2, 3],
    [4, 5],
  ])('with %i wingmen the limit is %i and acquisition pauses when full', (wingmen, limit) => {
    const w = setup();
    addWingmen(w, wingmen);
    expect(lockLimit(w)).toBe(limit);
    targetsInCone(w, 7);
    run(w, (w.tuning.lockon.lockTime + 0.05) * 8);
    expect(w.lockon.locks).toHaveLength(limit);
    expect(w.lockon.acquiringId).toBe(-1);
  });

  it('only living wingmen count, and lockCap caps the limit', () => {
    const w = setup();
    addWingmen(w, 4);
    w.squadron.wingmen[0]!.alive = false;
    expect(lockLimit(w)).toBe(4);
    w.tuning.lockon.lockCap = 2;
    expect(lockLimit(w)).toBe(2);
  });

  it('keeps existing locks when a wingman dies (they simply stay in priority order)', () => {
    const w = setup();
    addWingmen(w, 2);
    targetsInCone(w, 3);
    run(w, (w.tuning.lockon.lockTime + 0.05) * 4);
    expect(w.lockon.locks).toHaveLength(3);
    w.squadron.wingmen[0]!.alive = false;
    run(w, 0.5);
    expect(w.lockon.locks).toHaveLength(3);
    expect(lockLimit(w)).toBe(2);
  });
});

describe('losing locks', () => {
  function locked(): World {
    const w = setup();
    w.targets.push(target(800, 0, 20));
    run(w, w.tuning.lockon.lockTime + 0.1);
    expect(w.lockon.locks).toEqual([0]);
    return w;
  }

  it('survives a short slip out of the cone (grace), then is lost with reason cone', () => {
    const w = locked();
    w.ship.heading = 90 * DEG; // target far outside the cone
    run(w, w.tuning.lockon.lockGrace * 0.5);
    expect(w.lockon.locks).toEqual([0]);
    expect(w.lockon.graces[0]).toBeGreaterThan(0);
    w.ship.heading = 0; // back in time: grace resets
    run(w, DT);
    expect(w.lockon.graces[0]).toBe(0);
    w.ship.heading = 90 * DEG;
    w.events.clear();
    const seen: string[] = [];
    for (let i = 0; i < 60; i++) {
      w.events.clear();
      stepLockOn(w);
      for (const e of w.events.events) if (e.type === 'LockLost') seen.push(e.reason);
    }
    expect(seen).toEqual(['cone']);
    expect(w.lockon.locks).toEqual([]);
  });

  it('is lost when the target leaves range, with reason range', () => {
    const w = locked();
    w.targets[0]!.x = w.tuning.lockon.lockRange + 500;
    w.events.clear();
    stepLockOn(w);
    expect(w.events.events).toContainEqual({ type: 'LockLost', targetId: 0, reason: 'range' });
    expect(w.lockon.locks).toEqual([]);
  });

  it('is lost when the target dies, with reason dead', () => {
    const w = locked();
    w.targets[0]!.alive = false;
    w.events.clear();
    stepLockOn(w);
    expect(w.events.events).toContainEqual({ type: 'LockLost', targetId: 0, reason: 'dead' });
  });

  it('a stale fighter id is treated as dead', () => {
    const w = setup();
    w.fighters.push({ x: 600, y: 0, vx: 0, vy: 0, radius: 28, hp: 3, alive: true } as Fighter);
    run(w, w.tuning.lockon.lockTime + 0.1);
    expect(w.lockon.locks).toEqual([FIGHTER_ID_BASE]);
    w.fighters.length = 0;
    w.events.clear();
    stepLockOn(w);
    expect(w.lockon.locks).toEqual([]);
  });

  it('an acquiring target resets its progress after the grace, and pauses during it', () => {
    const w = setup();
    w.targets.push(target(800, 0, 20));
    run(w, 0.5);
    const progress = w.lockon.progress;
    expect(progress).toBeGreaterThan(0.4);
    w.ship.heading = 90 * DEG;
    run(w, w.tuning.lockon.lockGrace * 0.5);
    expect(w.lockon.progress).toBe(progress); // paused, not lost
    expect(w.lockon.acquiringId).toBe(0);
    run(w, w.tuning.lockon.lockGrace);
    expect(w.lockon.acquiringId).toBe(-1);
    expect(w.lockon.progress).toBe(0);
  });

  it('a lost target can be locked again afterwards', () => {
    const w = locked();
    w.ship.heading = 90 * DEG;
    run(w, 1);
    expect(w.lockon.locks).toEqual([]);
    w.ship.heading = 0;
    run(w, w.tuning.lockon.lockTime + 0.1);
    expect(w.lockon.locks).toEqual([0]);
  });
});

describe('determinism and state', () => {
  it('the same inputs give the same lock state and hash', () => {
    const make = (): World => {
      const w = setup();
      w.targets.push(target(800, 0, 20), target(900, 30, 20));
      addWingmen(w, 1);
      run(w, 1.4);
      return w;
    };
    const a = make();
    const b = make();
    expect(a.lockon).toEqual(b.lockon);
    expect(hashWorld(a)).toBe(hashWorld(b));
  });

  it('every lock field changes the replay hash', () => {
    const w = setup();
    const h0 = hashWorld(w);
    w.lockon.locks.push(2);
    w.lockon.graces.push(0);
    const h1 = hashWorld(w);
    expect(h1).not.toBe(h0);
    w.lockon.graces[0] = 0.1;
    const h2 = hashWorld(w);
    expect(h2).not.toBe(h1);
    w.lockon.acquiringId = 5;
    const h3 = hashWorld(w);
    expect(h3).not.toBe(h2);
    w.lockon.progress = 0.3;
    const h4 = hashWorld(w);
    expect(h4).not.toBe(h3);
    w.lockon.acquiringGrace = 0.2;
    expect(hashWorld(w)).not.toBe(h4);
  });

  it('createLockOn is empty, and a respawn clears the lock state', () => {
    expect(createLockOn()).toEqual({
      locks: [],
      graces: [],
      acquiringId: -1,
      progress: 0,
      acquiringGrace: 0,
    });
    const tuning = createTuning();
    tuning.arena.staticCount = 0; // an empty arena, so nothing can be acquired right after the reset
    tuning.arena.droneCount = 0;
    tuning.arena.turretCount = 0;
    const w = createWorld(1, tuning);
    w.lockon.locks.push(1);
    w.lockon.graces.push(0);
    w.lockon.acquiringId = 3;
    w.actions.respawn = true;
    stepWorld(w, DT); // the whole world step, so the reset path is the real one
    expect(w.lockon).toEqual(createLockOn());
  });
});
