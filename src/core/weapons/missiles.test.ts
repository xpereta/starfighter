import { describe, expect, it } from 'vitest';
import { createTuning } from '../../../data/tuning';
import type { Fighter } from '../ai/fighters';
import { CAPITAL_PARTS } from '../../../data/content/capital';
import { spawnCapitalAt } from '../enemies/capital-battle';
import { createShip } from '../flight/flight';
import type { Wingman } from '../squadron/squadron';
import { DEG } from '../math';
import { hashWorld } from '../replay/hash';
import { FIGHTER_ID_BASE } from '../world/lockable';
import type { Target } from '../world/target';
import { createWorld, stepWorld, type World } from '../world/world';
import {
  assignSalvo,
  createMissilePool,
  launchOrigin,
  mixMissiles,
  PLAYER,
  salvoPilots,
  salvoSize,
  stepMissiles,
} from './missiles';

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

/** A world with an empty arena and a ship at rest at the origin pointing along +x. */
function setup(wingmen = 0): World {
  const world = createWorld(1, createTuning());
  world.targets.length = 0;
  world.ship.vx = 0;
  world.ship.vy = 0;
  for (let i = 0; i < wingmen; i++) {
    world.squadron.wingmen.push({
      ship: createShip(world.tuning.flight),
      hp: 3,
      alive: true,
    } as Wingman);
  }
  return world;
}

/** One missile step, mirroring stepWorld's edge tracking: `launch` is the button state this step. */
function tick(w: World, launch = false): void {
  w.events.clear();
  w.actions.launch = launch;
  stepMissiles(w);
  w.prev.launch = launch;
}

const eventsOf = (w: World, type: string): number =>
  w.events.events.filter((e) => e.type === type).length;

describe('assignSalvo', () => {
  const out: number[] = [];
  it('round-robins in lock order: more pilots than locks double up from the top', () => {
    expect(assignSalvo([10, 20], 3, out)).toEqual([10, 20, 10]);
    expect(assignSalvo([10, 20], 5, out)).toEqual([10, 20, 10, 20, 10]);
  });
  it('uses only the first locks when there are more locks than pilots', () => {
    expect(assignSalvo([10, 20, 30], 2, out)).toEqual([10, 20]);
    expect(assignSalvo([10, 20], 1, out)).toEqual([10]);
  });
  it('gives nothing without locks', () => {
    expect(assignSalvo([], 4, out)).toEqual([]);
  });
});

describe('launch rules', () => {
  it('does nothing without locks', () => {
    const w = setup();
    tick(w, true);
    expect(eventsOf(w, 'SalvoFired')).toBe(0);
    expect(w.missiles.count).toBe(0);
  });

  it('launches one missile per pilot, in lock order, with SalvoFired and MissileLaunched', () => {
    const w = setup(2);
    w.targets.push(target(800, 0), target(800, 200), target(800, -200));
    w.lockon.locks.push(0, 1, 2);
    expect(salvoSize(w)).toBe(3);
    const launched: number[] = [];
    let fired = 0;
    tick(w, true);
    for (let i = 0; i < 60; i++) {
      for (const e of w.events.events) {
        if (e.type === 'MissileLaunched') launched.push(e.targetId);
        if (e.type === 'SalvoFired') fired = e.count;
      }
      tick(w, true);
    }
    expect(fired).toBe(3);
    expect(launched).toEqual([0, 1, 2]);
  });

  it('is edge-triggered: holding the button fires once, a new press after the cooldown fires again', () => {
    const w = setup();
    w.targets.push(target(5000, 0));
    w.lockon.locks.push(0);
    let salvos = 0;
    const count = (): void => {
      salvos += eventsOf(w, 'SalvoFired');
    };
    for (let i = 0; i < 60 * 6; i++) {
      tick(w, true); // held for 6 s, longer than the cooldown
      count();
    }
    expect(salvos).toBe(1);
    w.lockon.locks.push(0); // a launch spends the locks, so the next salvo needs a fresh one
    tick(w, false);
    tick(w, true);
    count();
    expect(salvos).toBe(2);
  });

  it('enforces the cooldown from the launch', () => {
    const w = setup();
    w.targets.push(target(5000, 0));
    w.lockon.locks.push(0);
    tick(w, true);
    expect(eventsOf(w, 'SalvoFired')).toBe(1);
    for (let t = 0; t < w.tuning.missiles.salvoCooldown - 0.2; t += DT) tick(w, false);
    tick(w, true); // pressed inside the cooldown
    expect(eventsOf(w, 'SalvoFired')).toBe(0);
    tick(w, false);
    for (let t = 0; t < 0.4; t += DT) tick(w, false);
    w.lockon.locks.push(0); // fresh lock after the first salvo spent its own
    tick(w, true); // pressed after it
    expect(eventsOf(w, 'SalvoFired')).toBe(1);
  });

  it('staggers the missiles of a salvo by salvoStagger', () => {
    const w = setup(2);
    w.targets.push(target(5000, 0));
    w.lockon.locks.push(0);
    const stepsAt: number[] = [];
    tick(w, true);
    for (let i = 0; i < 40; i++) {
      for (const e of w.events.events) if (e.type === 'MissileLaunched') stepsAt.push(i);
      tick(w, true);
    }
    expect(stepsAt).toHaveLength(3);
    const gap = Math.round(w.tuning.missiles.salvoStagger / DT);
    expect(stepsAt[1]! - stepsAt[0]!).toBeGreaterThanOrEqual(gap - 1);
    expect(stepsAt[1]! - stepsAt[0]!).toBeLessThanOrEqual(gap + 1);
    expect(stepsAt[2]! - stepsAt[1]!).toBeGreaterThanOrEqual(gap - 1);
    expect(stepsAt[2]! - stepsAt[1]!).toBeLessThanOrEqual(gap + 1);
  });

  it('drops missiles that do not fit in the pool, without an event', () => {
    const w = setup(2);
    const small = createMissilePool({ ...w.tuning.missiles, missileCap: 2 });
    Object.assign(w, { missiles: small });
    w.targets.push(target(5000, 0));
    w.lockon.locks.push(0);
    let launched = 0;
    tick(w, true);
    for (let i = 0; i < 60; i++) {
      launched += eventsOf(w, 'MissileLaunched');
      tick(w, true);
    }
    expect(launched).toBe(2);
    expect(w.missiles.count).toBeLessThanOrEqual(2);
  });
});

describe('missile motion', () => {
  /** A missile with a dead target flies straight: the cleanest way to test speed. */
  function straight(): World {
    const w = setup();
    w.tuning.missiles.wobbleAmount = 0;
    const dead = target(5000, 0);
    dead.alive = false;
    w.targets.push(dead);
    w.lockon.locks.push(0);
    return w;
  }

  it('starts at launchSpeed plus the launcher forward speed, accelerates, and caps at the max', () => {
    const w = straight();
    w.ship.vx = 100; // forward speed adds to the launch speed
    tick(w, true);
    const cfg = w.tuning.missiles;
    expect(w.missiles.data.speed[0]).toBeCloseTo(cfg.launchSpeed + 100 + cfg.missileAccel * DT, 3);
    for (let i = 0; i < 30; i++) tick(w);
    expect(w.missiles.data.speed[0]).toBeCloseTo(
      cfg.launchSpeed + 100 + cfg.missileAccel * 31 * DT,
      1,
    );
    for (let i = 0; i < 200; i++) tick(w);
    expect(w.missiles.data.speed[0]).toBe(cfg.missileMaxSpeed);
  });

  it('a launcher moving backwards does not slow the launch', () => {
    const w = straight();
    w.ship.vx = -300;
    tick(w, true);
    expect(w.missiles.data.speed[0]).toBeCloseTo(
      w.tuning.missiles.launchSpeed + w.tuning.missiles.missileAccel * DT,
      3,
    );
  });

  it('leaves from the nose and moves by velocity * dt', () => {
    const w = straight();
    tick(w, true);
    expect(w.missiles.data.x[0]).toBeGreaterThan(w.tuning.weapons.muzzleOffset);
    const x0 = w.missiles.data.x[0]!;
    tick(w);
    expect(w.missiles.data.x[0]! - x0).toBeCloseTo(w.missiles.data.vx[0]! * DT, 3);
  });

  it('expires after missileLife', () => {
    const w = straight();
    w.tuning.missiles.missileLife = 1;
    tick(w, true);
    for (let i = 0; i < 55; i++) tick(w);
    expect(w.missiles.count).toBe(1);
    for (let i = 0; i < 10; i++) tick(w);
    expect(w.missiles.count).toBe(0);
  });

  it('wobble stays within wobbleAmount of the heading and is the same for the same seed', () => {
    const run = (seed: number): number[] => {
      const w = straight();
      Object.assign(w, createWorld(seed, w.tuning)); // same tuning, different seed
      w.targets.length = 0;
      w.ship.vx = 0;
      const dead = target(5000, 0);
      dead.alive = false;
      w.targets.push(dead);
      w.lockon.locks.push(0);
      w.tuning.missiles.wobbleAmount = 5;
      const angles: number[] = [];
      tick(w, true);
      for (let i = 0; i < 120; i++) {
        tick(w);
        const d = w.missiles.data;
        const off = Math.atan2(d.vy[0]!, d.vx[0]!) - d.heading[0]!;
        expect(Math.abs(off)).toBeLessThanOrEqual(5 * DEG + 1e-3);
        angles.push(off);
      }
      return angles;
    };
    const a = run(7);
    expect(Math.max(...a.map(Math.abs))).toBeGreaterThan(1 * DEG); // it really weaves
    expect(run(7)).toEqual(a);
    expect(run(8)).not.toEqual(a);
  });
});

describe('homing', () => {
  it('turns toward the target no faster than missileTurnRate, and reaches it', () => {
    const w = setup();
    w.tuning.missiles.wobbleAmount = 0;
    w.targets.push(target(300, 400, 30)); // well off the nose
    w.lockon.locks.push(0);
    const limit = w.tuning.missiles.missileTurnRate * DEG * DT;
    tick(w, true);
    let prev = w.missiles.data.heading[0]!;
    let maxTurn = 0;
    for (let i = 0; i < 180 && w.missiles.count > 0; i++) {
      tick(w);
      if (w.missiles.count === 0) break;
      const h = w.missiles.data.heading[0]!;
      maxTurn = Math.max(maxTurn, Math.abs(h - prev));
      expect(Math.abs(h - prev)).toBeLessThanOrEqual(limit + 1e-4);
      prev = h;
    }
    expect(maxTurn).toBeGreaterThan(limit * 0.9); // it did turn as fast as allowed
    expect(w.targets[0]!.hp).toBeLessThan(3); // and it hit
  });

  it('flies straight on when its target dies', () => {
    const w = setup();
    w.tuning.missiles.wobbleAmount = 0;
    w.targets.push(target(3000, 800, 30));
    w.lockon.locks.push(0);
    tick(w, true);
    for (let i = 0; i < 20; i++) tick(w);
    const heading = w.missiles.data.heading[0]!;
    w.targets[0]!.alive = false;
    tick(w);
    expect(w.missiles.data.targetId[0]).toBe(-1);
    const after = w.missiles.data.heading[0]!;
    for (let i = 0; i < 20; i++) tick(w);
    expect(w.missiles.data.heading[0]).toBeCloseTo(after, 6);
    expect(Math.abs(after - heading)).toBeLessThan(5 * DEG); // at most one step of homing
  });
});

describe('hits', () => {
  it('damages the target, emits Hit with the missile impulse, and is consumed', () => {
    const w = setup();
    w.tuning.missiles.wobbleAmount = 0;
    w.targets.push(target(700, 0, 30));
    w.lockon.locks.push(0);
    tick(w, true);
    let hitEvent: { impulse: number; dirX: number } | null = null;
    let impact = false;
    for (let i = 0; i < 120 && !hitEvent; i++) {
      tick(w);
      for (const e of w.events.events) {
        if (e.type === 'Hit') hitEvent = e;
        if (e.type === 'MissileImpact') impact = true;
      }
    }
    expect(hitEvent).not.toBeNull();
    expect(impact).toBe(true);
    expect(hitEvent!.impulse).toBe(w.tuning.missiles.missileHitImpulse);
    expect(hitEvent!.impulse).toBeGreaterThan(w.tuning.weapons.hitImpulse);
    expect(hitEvent!.dirX).toBeGreaterThan(0.9);
    expect(w.targets[0]!.hp).toBe(3 - w.tuning.missiles.missileDamage);
    expect(w.missiles.count).toBe(0);
  });

  it('hits any enemy in its way, not just its target', () => {
    const w = setup();
    w.tuning.missiles.wobbleAmount = 0;
    w.targets.push(target(1200, 0, 30), target(400, 0, 30)); // blocker at index 1
    w.lockon.locks.push(0);
    tick(w, true);
    for (let i = 0; i < 90; i++) tick(w);
    expect(w.targets[1]!.hp).toBeLessThan(3);
    expect(w.targets[0]!.hp).toBe(3);
  });

  it('damages fighters through the shared id space', () => {
    const w = setup();
    w.tuning.missiles.wobbleAmount = 0;
    w.fighters.push({ x: 700, y: 0, vx: 0, vy: 0, radius: 28, hp: 3, alive: true } as Fighter);
    w.lockon.locks.push(FIGHTER_ID_BASE);
    tick(w, true);
    for (let i = 0; i < 120; i++) tick(w);
    expect(w.fighters[0]!.hp).toBe(3 - w.tuning.missiles.missileDamage);
  });

  it('ignores dead enemies', () => {
    const w = setup();
    w.tuning.missiles.wobbleAmount = 0;
    const dead = target(700, 0, 30);
    dead.alive = false;
    w.targets.push(dead);
    w.lockon.locks.push(0);
    tick(w, true);
    for (let i = 0; i < 120; i++) tick(w);
    expect(dead.hp).toBe(3);
  });

  it('a missile kills a drone through the normal world step (Killed event, kill count)', () => {
    const tuning = createTuning();
    tuning.arena.staticCount = 0;
    tuning.arena.droneCount = 0;
    tuning.arena.turretCount = 0;
    tuning.missiles.wobbleAmount = 0;
    const w = createWorld(3, tuning);
    w.targets.push(target(1100, 0, 30));
    w.lockon.locks.push(0);
    w.actions.launch = true;
    let killed = 0;
    for (let i = 0; i < 60 * 4; i++) {
      stepWorld(w, DT);
      w.actions.launch = false;
      for (const e of w.events.events) if (e.type === 'Killed') killed++;
    }
    expect(killed).toBe(1);
    expect(w.stats.kills).toBe(1);
  });
});

describe('state, hash and reset', () => {
  it('every missile field and every salvo field changes the replay hash', () => {
    const w = setup();
    const seen = new Set<string>([hashWorld(w)]);
    const expectNew = (): void => {
      const h = hashWorld(w);
      expect(seen.has(h)).toBe(false);
      seen.add(h);
    };
    const i = w.missiles.spawn();
    expectNew();
    for (const field of Object.keys(w.missiles.data) as (keyof typeof w.missiles.data)[]) {
      w.missiles.data[field][i] = w.missiles.data[field][i]! + 1.25;
      expectNew();
    }
    w.missiles.salvo.cooldown = 1.5;
    expectNew();
    w.missiles.salvo.nextIn = 0.5;
    expectNew();
    w.missiles.salvo.launched = 2;
    expectNew();
    w.missiles.salvo.nextUid = 9;
    expectNew();
    w.missiles.salvo.pending.push(7);
    expectNew();
  });

  it('gives every missile a unique, stable uid that survives other missiles being removed', () => {
    const w = setup(2);
    w.tuning.missiles.wobbleAmount = 0;
    w.targets.push(target(5000, 0));
    w.lockon.locks.push(0);
    tick(w, true);
    for (let i = 0; i < 40; i++) tick(w, true);
    expect(w.missiles.count).toBe(3);
    const uids = [0, 1, 2].map((i) => w.missiles.data.uid[i]);
    expect(new Set(uids).size).toBe(3);
    const second = w.missiles.data.uid[1]!;
    const x = w.missiles.data.x[1]!;
    w.missiles.remove(0); // swaps the last missile into slot 0
    expect([...Array(w.missiles.count).keys()].map((i) => w.missiles.data.uid[i])).toContain(
      second,
    );
    expect(w.missiles.data.x[w.missiles.data.uid.indexOf(second)]).toBe(x);
  });

  it('the same inputs give the same missiles and hash', () => {
    const make = (): World => {
      const w = setup(2);
      w.targets.push(target(900, 100), target(900, -100));
      w.lockon.locks.push(0, 1);
      tick(w, true);
      for (let i = 0; i < 90; i++) tick(w);
      return w;
    };
    expect(hashWorld(make())).toBe(hashWorld(make()));
  });

  it('a respawn clears the missiles, the salvo and the cooldown', () => {
    const tuning = createTuning();
    tuning.arena.staticCount = 0;
    tuning.arena.droneCount = 0;
    tuning.arena.turretCount = 0;
    const w = createWorld(1, tuning);
    w.missiles.spawn();
    w.missiles.salvo.cooldown = 3;
    w.missiles.salvo.pending.push(1, 2);
    w.missiles.salvo.pilots.push(0, 1);
    w.actions.respawn = true;
    stepWorld(w, DT);
    expect(w.missiles.count).toBe(0);
    expect(w.missiles.salvo).toEqual({
      cooldown: 0,
      pending: [],
      pilots: [],
      nextIn: 0,
      launched: 0,
      nextUid: 0,
    });
  });
});

describe('every pilot fires from their own ship', () => {
  /** Player at the origin facing +x; wingman 0 up and to the right facing +y; wingman 1 behind-left facing -x. */
  function squad(): World {
    const w = setup(2);
    const a = w.squadron.wingmen[0]!.ship;
    a.x = 500;
    a.y = 300;
    a.heading = Math.PI / 2;
    a.vx = 0;
    a.vy = 250;
    const b = w.squadron.wingmen[1]!.ship;
    b.x = -400;
    b.y = -200;
    b.heading = Math.PI;
    b.vx = -250;
    b.vy = 0;
    w.targets.push(target(2000, 0), target(2000, 500), target(2000, -500));
    w.lockon.locks.push(0, 1, 2);
    return w;
  }

  const launches = (w: World): { x: number; y: number; angle: number; targetId: number }[] => {
    const out: { x: number; y: number; angle: number; targetId: number }[] = [];
    tick(w, true);
    for (let i = 0; i < 90; i++) {
      for (const e of w.events.events) if (e.type === 'MissileLaunched') out.push(e);
      tick(w);
    }
    return out;
  };

  it('puts the player first, then each living wingman, in squadron order', () => {
    const w = squad();
    expect(salvoPilots(w, [])).toEqual([PLAYER, 0, 1]);
    w.squadron.wingmen[0]!.alive = false;
    expect(salvoPilots(w, [])).toEqual([PLAYER, 1]);
    expect(salvoSize(w)).toBe(2);
  });

  it('launch origins are the noses of the three ships, not all the player', () => {
    const w = squad();
    const off = w.tuning.weapons.muzzleOffset;
    const p = { ...launchOrigin(w, PLAYER) };
    const a = { ...launchOrigin(w, 0) };
    const b = { ...launchOrigin(w, 1) };
    expect([p.x, p.y]).toEqual([off, 0]);
    expect(a.x).toBeCloseTo(500);
    expect(a.y).toBeCloseTo(300 + off);
    expect(a.heading).toBeCloseTo(Math.PI / 2);
    expect(b.x).toBeCloseTo(-400 - off);
    expect(b.y).toBeCloseTo(-200);
    expect(a.vy).toBe(250);
  });

  it('a salvo of three leaves from the player, wingman 0 and wingman 1 in that order, at their locks', () => {
    const w = squad();
    const off = w.tuning.weapons.muzzleOffset;
    const l = launches(w);
    expect(l).toHaveLength(3);
    expect(l.map((m) => m.targetId)).toEqual([0, 1, 2]);
    expect([l[0]!.x, l[0]!.y]).toEqual([off, 0]);
    expect(l[1]!.x).toBeCloseTo(500);
    expect(l[1]!.y).toBeCloseTo(300 + off);
    expect(l[1]!.angle).toBeCloseTo(Math.PI / 2);
    expect(l[2]!.x).toBeCloseTo(-400 - off);
    expect(l[2]!.y).toBeCloseTo(-200);
    expect(Math.abs(l[2]!.angle)).toBeCloseTo(Math.PI);
  });

  it('a wingman missile starts with its wingman speed along its own heading', () => {
    const w = squad();
    tick(w, true);
    for (let i = 0; i < 40; i++) tick(w);
    // Missiles in launch order are in pool order until one is removed; find wingman 0's by uid.
    const idx = [...Array(w.missiles.count).keys()].find((i) => w.missiles.data.uid[i] === 1)!;
    const speed = Math.hypot(w.missiles.data.vx[idx]!, w.missiles.data.vy[idx]!);
    expect(speed).toBeGreaterThanOrEqual(w.tuning.missiles.launchSpeed);
    expect(w.missiles.data.heading[idx]).toBeDefined();
  });

  it('a wingman shot down before their turn in the ripple does not fire', () => {
    const w = squad();
    const l: { targetId: number }[] = [];
    let announced = 0;
    tick(w, true);
    for (const e of w.events.events) if (e.type === 'SalvoFired') announced = e.count;
    w.squadron.wingmen[0]!.alive = false; // dies right after the salvo is called
    for (let i = 0; i < 90; i++) {
      for (const e of w.events.events) if (e.type === 'MissileLaunched') l.push(e);
      tick(w);
    }
    expect(announced).toBe(3);
    expect(l.map((m) => m.targetId)).toEqual([0, 2]); // wingman 0's missile (target 1) never left
    expect(w.missiles.salvo.pending).toEqual([]);
    expect(w.missiles.salvo.pilots).toEqual([]);
  });

  it("with no wingmen the whole salvo is the player's", () => {
    const w = setup(0);
    w.targets.push(target(2000, 0));
    w.lockon.locks.push(0);
    const l = launches(w);
    expect(l).toHaveLength(1);
    expect(l[0]!.x).toBeCloseTo(w.tuning.weapons.muzzleOffset);
  });

  it('who fires a pending missile is part of the replay hash', () => {
    const w = squad();
    const hashOf = (): string => {
      const parts: number[] = [];
      mixMissiles((n) => parts.push(n), w.missiles);
      return parts.join(',');
    };
    const base = hashOf();
    w.missiles.salvo.pilots.push(1);
    expect(hashOf()).not.toBe(base);
  });
});

describe('a launch spends the locks', () => {
  it('empties the lock set and its grace timers, but the salvo keeps the targets it was assigned', () => {
    const w = setup(1);
    w.targets.push(target(3000, 0), target(3000, 400));
    w.lockon.locks.push(0, 1);
    w.lockon.graces.push(0, 0.2);
    const launched: number[] = [];
    tick(w, true);
    expect(w.lockon.locks).toEqual([]);
    expect(w.lockon.graces).toEqual([]);
    for (let i = 0; i < 60; i++) {
      for (const e of w.events.events) if (e.type === 'MissileLaunched') launched.push(e.targetId);
      tick(w);
    }
    expect(launched).toEqual([0, 1]); // both missiles still left at their assigned targets
  });

  it('cannot fire again after the cooldown until new locks are acquired', () => {
    const w = setup();
    w.targets.push(target(3000, 0));
    w.lockon.locks.push(0);
    tick(w, true);
    for (let t = 0; t < w.tuning.missiles.salvoCooldown + 1; t += DT) tick(w, false);
    tick(w, true); // cooldown over, but no locks left
    expect(eventsOf(w, 'SalvoFired')).toBe(0);
    w.lockon.locks.push(0);
    tick(w, false);
    tick(w, true);
    expect(eventsOf(w, 'SalvoFired')).toBe(1);
  });

  it('does not stop a target being acquired from completing its lock afterwards', () => {
    const w = setup();
    w.targets.push(target(800, 0), target(800, 200));
    w.lockon.locks.push(0);
    w.lockon.acquiringId = 1;
    w.lockon.progress = 0.5;
    tick(w, true);
    expect(w.lockon.acquiringId).toBe(1);
    expect(w.lockon.progress).toBe(0.5);
  });
});

describe('a missile touching two parts of the capital ship', () => {
  it('hits the part whose surface it is deepest in, not the one with the nearer centre', () => {
    const world = createWorld(1, createTuning());
    world.targets.length = 0;
    const cap = spawnCapitalAt(world, 1500, 0);
    cap.heading = 0;
    cap.vx = 0;
    cap.vy = 0;
    const front = CAPITAL_PARTS.findIndex((p) => p.id === 'plate-front');
    const port = CAPITAL_PARTS.findIndex((p) => p.id === 'plate-port');
    // (70, 65) in ship space: nearer the front plate's centre, but deeper inside the port plate's capsule.
    const i = world.missiles.spawn();
    const d = world.missiles.data;
    d.x[i] = cap.x + 70;
    d.y[i] = cap.y + 65;
    d.vx[i] = 0;
    d.vy[i] = 0;
    d.speed[i] = 0;
    d.heading[i] = 0;
    d.life[i] = 5;
    d.targetId[i] = -1;
    d.damageScale[i] = 1;
    const before = [cap.parts[front]!.hp, cap.parts[port]!.hp];
    stepMissiles(world);
    expect(world.missiles.count).toBe(0); // spent on a hit
    expect(cap.parts[front]!.hp).toBe(before[0]);
    expect(cap.parts[port]!.hp).toBeLessThan(before[1]!);
  });
});
