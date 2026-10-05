import { describe, expect, it } from 'vitest';
import { createTuning } from '../../../data/tuning';
import { hashWorld } from '../replay/hash';
import { createWingman } from '../squadron/wingmen';
import { wrapAngle } from '../math';
import { FIGHTER_ID_BASE, forEachLockable } from '../world/lockable';
import { createWorld, stepWorld, type World } from '../world/world';
import { stepBullets } from '../weapons/guns';
import { chooseTarget, stepFighters, targetOf } from './fighters';
import { spawnFighter, stepWaves } from './waves';

const DT = 1 / 60;

/** A world with no waves and a motionless player at the origin, so each test controls the scene. */
function arena() {
  const tuning = createTuning();
  tuning.fighter.waveSize = 0;
  const world = createWorld(1, tuning);
  world.ship.vx = 0;
  world.ship.vy = 0;
  return world;
}

/** Runs only the fighter AI for `n` steps (the player and everything else stand still). */
function aiSteps(world: World, n = 1): void {
  for (let i = 0; i < n; i++) {
    world.tick += 1;
    world.time += DT;
    stepFighters(world);
  }
}

function addWingman(world: World, x: number, y: number): number {
  const wingman = createWingman(world, world.squadron.wingmen.length, 4);
  wingman.ship.x = x;
  wingman.ship.y = y;
  wingman.ship.vx = 0;
  wingman.ship.vy = 0;
  world.squadron.wingmen.push(wingman);
  return world.squadron.wingmen.length - 1;
}

describe('targeting', () => {
  it('picks the nearest of the player and the living wingmen', () => {
    const world = arena();
    expect(chooseTarget(world, 1000, 0)).toBe(-1);
    const near = addWingman(world, 900, 200);
    addWingman(world, -3000, 0);
    expect(chooseTarget(world, 1000, 0)).toBe(near);
    world.squadron.wingmen[near]!.alive = false;
    expect(chooseTarget(world, 1000, 0)).toBe(-1);
  });

  it('targetOf resolves the player, a living wingman, and null for a dead or missing one', () => {
    const world = arena();
    const w = addWingman(world, 5, 5);
    expect(targetOf(world, -1)).toBe(world.ship);
    expect(targetOf(world, w)).toBe(world.squadron.wingmen[w]!.ship);
    world.squadron.wingmen[w]!.alive = false;
    expect(targetOf(world, w)).toBeNull();
    expect(targetOf(world, 7)).toBeNull();
  });

  it('re-picks its target only when the retarget interval is up', () => {
    const world = arena();
    const interval = world.tuning.fighter.retargetInterval;
    const i = spawnFighter(world, 3000, 0, Math.PI, interval);
    const w = addWingman(world, 2900, 200); // nearer than the player at the origin, even after the fighter flies on
    aiSteps(world, Math.floor((interval - 0.3) / DT));
    expect(world.fighters[i]!.targetIndex).toBe(-1);
    aiSteps(world, Math.ceil(0.6 / DT));
    expect(world.fighters[i]!.targetIndex).toBe(w);
  });

  it('switches at once when the wingman it was chasing dies', () => {
    const world = arena();
    const i = spawnFighter(world, 1000, 0, Math.PI, 0);
    const w = addWingman(world, 900, 200);
    aiSteps(world, 1);
    expect(world.fighters[i]!.targetIndex).toBe(w);
    world.squadron.wingmen[w]!.alive = false;
    aiSteps(world, 1);
    expect(world.fighters[i]!.targetIndex).toBe(-1);
  });
});

describe('guns', () => {
  it('fires when the target is inside the cone and the range, and keeps its fire rate', () => {
    const world = arena();
    const i = spawnFighter(world, 600, 0, Math.PI);
    aiSteps(world, 1);
    expect(world.enemyShots.count).toBe(1);
    const f = world.fighters[i]!;
    expect(f.fireCooldown).toBeCloseTo(1 / world.tuning.fighter.fireRate, 3);
    aiSteps(world, 5); // well inside one fire interval
    expect(world.enemyShots.count).toBe(1);
  });

  it('shots leave the muzzle with the fighter velocity plus the (slower) bullet speed', () => {
    const world = arena();
    world.tuning.fighter.spread = 0;
    const cfg = world.tuning.fighter;
    const i = spawnFighter(world, 600, 0, Math.PI);
    const f = world.fighters[i]!;
    const vx = f.ship.vx;
    aiSteps(world, 1);
    const shots = world.enemyShots;
    expect(shots.data.vx[0]!).toBeCloseTo(vx - cfg.bulletSpeed, 0); // pointing at the player (-x)
    expect(Math.abs(shots.data.vx[0]!)).toBeLessThan(900 + 360); // slower than the player's guns
    expect(shots.data.life[0]).toBeCloseTo(cfg.bulletLife);
  });

  it('does not fire out of range', () => {
    const world = arena();
    spawnFighter(world, world.tuning.fighter.fireRange + 800, 0, Math.PI);
    aiSteps(world, 5);
    expect(world.enemyShots.count).toBe(0);
  });

  it('does not fire while the target is outside the cone', () => {
    const world = arena();
    spawnFighter(world, 600, 0, Math.PI / 2); // flying sideways, 90 degrees off
    aiSteps(world, 1);
    expect(world.enemyShots.count).toBe(0);
  });

  it('a full shot pool drops shots without crashing', () => {
    const world = arena();
    for (let k = 0; k < world.enemyShots.capacity; k++) world.enemyShots.spawn();
    spawnFighter(world, 600, 0, Math.PI);
    aiSteps(world, 3);
    expect(world.enemyShots.count).toBe(world.enemyShots.capacity);
  });
});

describe('break-away', () => {
  const hit = (world: World, i: number) => {
    world.fighters[i]!.hp -= 1;
  };

  it('breaks after two hits within the window, with an evade roll', () => {
    const world = arena();
    const i = spawnFighter(world, 1500, 0, Math.PI);
    world.fighters[i]!.hp = 5;
    world.fighters[i]!.lastHp = 5;
    aiSteps(world, 1);
    hit(world, i);
    aiSteps(world, 1);
    expect(world.fighters[i]!.breakTimer).toBe(0); // one hit is not enough
    aiSteps(world, 10);
    hit(world, i);
    aiSteps(world, 1);
    const f = world.fighters[i]!;
    expect(f.breakTimer).toBeGreaterThan(0);
    expect(f.ship.evadeTimer).toBeGreaterThan(0);
  });

  it('does not break when the two hits are further apart than the window', () => {
    const world = arena();
    const i = spawnFighter(world, 1500, 0, Math.PI);
    world.fighters[i]!.hp = 5;
    world.fighters[i]!.lastHp = 5;
    aiSteps(world, 1);
    hit(world, i);
    aiSteps(world, 1);
    aiSteps(world, Math.ceil((world.tuning.fighter.breakHitWindow + 0.2) / DT));
    hit(world, i);
    aiSteps(world, 1);
    expect(world.fighters[i]!.breakTimer).toBe(0);
  });

  it('breaks when the player has it locked, turning away from its target', () => {
    const world = arena();
    const i = spawnFighter(world, 1500, 0, Math.PI);
    world.lockon.locks.push(FIGHTER_ID_BASE + i);
    aiSteps(world, 1);
    expect(world.fighters[i]!.breakTimer).toBeGreaterThan(0);
    aiSteps(world, 40);
    const f = world.fighters[i]!;
    const bearing = Math.atan2(world.ship.y - f.y, world.ship.x - f.x);
    expect(Math.abs(wrapAngle(f.ship.heading - bearing))).toBeGreaterThan(0.6);
  });

  it('after a break it waits the cooldown before breaking again, even while locked', () => {
    const world = arena();
    const cfg = world.tuning.fighter;
    const i = spawnFighter(world, 1500, 0, Math.PI);
    world.lockon.locks.push(FIGHTER_ID_BASE + i);
    aiSteps(world, 1);
    expect(world.fighters[i]!.breakTimer).toBeGreaterThan(0);
    aiSteps(world, Math.ceil((cfg.breakTime + 0.1) / DT));
    expect(world.fighters[i]!.breakTimer).toBe(0);
    aiSteps(world, Math.floor((cfg.breakCooldown - 0.5) / DT));
    expect(world.fighters[i]!.breakTimer).toBe(0); // still cooling down
    aiSteps(world, Math.ceil(1 / DT));
    expect(world.fighters[i]!.breakTimer).toBeGreaterThan(0); // allowed again
  });

  it('does not shoot while breaking away', () => {
    const world = arena();
    const i = spawnFighter(world, 600, 0, Math.PI);
    world.lockon.locks.push(FIGHTER_ID_BASE + i);
    aiSteps(world, 20);
    expect(world.enemyShots.count).toBe(0);
  });
});

describe('hp, bullets and death', () => {
  it('player bullets damage fighters; immune fighters are skipped', () => {
    const world = arena();
    const i = spawnFighter(world, 300, 0, Math.PI);
    const f = world.fighters[i]!;
    const shoot = () => {
      const k = world.bullets.spawn();
      world.bullets.data.x[k] = f.x;
      world.bullets.data.y[k] = f.y;
      world.bullets.data.vx[k] = 1;
      world.bullets.data.life[k] = 1;
      world.bullets.data.damage[k] = 1;
    };
    shoot();
    stepBullets(
      world.bullets,
      world.targets,
      world.tuning.weapons,
      world.events,
      DT,
      world.fighters,
    );
    expect(f.hp).toBe(world.tuning.fighter.health - 1);
    expect(world.events.events.some((e) => e.type === 'Hit')).toBe(true);
    expect(world.bullets.count).toBe(0);
    f.immune = true;
    shoot();
    stepBullets(
      world.bullets,
      world.targets,
      world.tuning.weapons,
      world.events,
      DT,
      world.fighters,
    );
    expect(f.hp).toBe(world.tuning.fighter.health - 1);
    expect(world.bullets.count).toBe(1); // passed through
  });

  it('a fighter at 0 hp dies once: Killed event, kill counted, no longer lockable or acting', () => {
    const world = arena();
    const i = spawnFighter(world, 600, 0, Math.PI);
    const f = world.fighters[i]!;
    f.hp = 0;
    stepWaves(world);
    stepWaves(world);
    const killed = world.events.events.filter((e) => e.type === 'Killed');
    expect(killed).toHaveLength(1);
    expect(killed[0]).toMatchObject({
      kind: 'fighter',
      entityId: FIGHTER_ID_BASE + i,
      radius: f.radius,
    });
    expect(world.stats.kills).toBe(1);
    expect(f.alive).toBe(false);
    let lockable = 0;
    forEachLockable(world, (id) => {
      if (id >= FIGHTER_ID_BASE) lockable++;
    });
    expect(lockable).toBe(0);
    const x = f.ship.x;
    aiSteps(world, 10);
    expect(f.ship.x).toBe(x);
    expect(world.enemyShots.count).toBe(0);
  });

  it('has the configured hp and radius', () => {
    const world = arena();
    const i = spawnFighter(world, 0, 0, 0);
    expect(world.fighters[i]!.hp).toBe(world.tuning.fighter.health);
    expect(world.fighters[i]!.radius).toBe(world.tuning.fighter.radius);
  });
});

describe('flying', () => {
  it('uses the player flight model with its own limits (slower top speed and turn rate)', () => {
    const world = arena();
    const i = spawnFighter(world, 3000, 0, Math.PI);
    aiSteps(world, 600);
    const f = world.fighters[i]!;
    expect(f.ship.speed).toBeLessThanOrEqual(
      world.tuning.flight.maxSpeed * world.tuning.fighter.speedScale + 1e-6,
    );
    expect(Math.abs(f.ship.omega)).toBeLessThanOrEqual(
      (world.tuning.flight.maxTurnRate * world.tuning.fighter.turnRateScale * Math.PI) / 180 + 1e-6,
    );
    expect(f.vx).toBe(f.ship.vx);
    expect(f.x).toBe(f.ship.x);
  });

  it('turns toward and closes on a distant target', () => {
    const world = arena();
    const i = spawnFighter(world, 3000, 800, 0); // pointing away
    const start = Math.hypot(3000, 800);
    aiSteps(world, 600);
    const f = world.fighters[i]!;
    expect(Math.hypot(f.x, f.y)).toBeLessThan(start);
  });

  it('stays inside the arena when the player is far outside it', () => {
    const world = arena();
    const R = world.tuning.flight.arenaRadius;
    world.ship.x = R * 3; // the player parked far away: the fighter must not follow it out
    const i = spawnFighter(world, R * 0.9, 0, 0);
    let furthest = 0;
    for (let s = 0; s < 60 * 40; s++) {
      aiSteps(world, 1);
      furthest = Math.max(furthest, Math.hypot(world.fighters[i]!.x, world.fighters[i]!.y));
    }
    expect(furthest).toBeLessThan(R + 800);
  });
});

describe('determinism and the replay hash', () => {
  it('the same seed gives the same fighters', () => {
    const run = () => {
      const w = createWorld(21, createTuning());
      for (let s = 0; s < 60 * 20; s++) stepWorld(w, DT);
      return hashWorld(w);
    };
    expect(run()).toBe(run());
  });

  it('every fighter field the AI changes is part of the hash', () => {
    const world = arena();
    const i = spawnFighter(world, 500, 100, 0.3);
    const f = world.fighters[i]!;
    const base = hashWorld(world);
    const changes: Array<[string, () => void]> = [
      ['x', () => (f.x += 1)],
      ['vx', () => (f.vx += 1)],
      ['hp', () => (f.hp -= 1)],
      ['alive', () => (f.alive = false)],
      ['ship heading', () => (f.ship.heading += 0.1)],
      ['ship speed', () => (f.ship.speed += 1)],
      ['evadeTimer', () => (f.ship.evadeTimer += 0.1)],
      ['targetIndex', () => (f.targetIndex = 2)],
      ['retargetTimer', () => (f.retargetTimer += 0.1)],
      ['fireCooldown', () => (f.fireCooldown += 0.1)],
      ['breakTimer', () => (f.breakTimer += 0.1)],
      ['breakCooldown', () => (f.breakCooldown += 0.1)],
      ['breakSide', () => (f.breakSide = -1)],
      ['lastHp', () => (f.lastHp -= 1)],
      ['hitTimeA', () => (f.hitTimeA = 1)],
      ['hitTimeB', () => (f.hitTimeB = 1)],
      ['diedAt', () => (f.diedAt = 5)],
    ];
    // Each change touches a different field, so each one must move the hash on its own.
    let previous = base;
    for (const [name, change] of changes) {
      change();
      const now = hashWorld(world);
      expect(now, `${name} must be part of the replay hash`).not.toBe(previous);
      previous = now;
    }
  });
});
