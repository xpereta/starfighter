import { describe, expect, it } from 'vitest';
import { createTuning } from '../../../data/tuning';
import { stepFighters } from '../ai/fighters';
import { spawnFighter } from '../ai/waves';
import { hashWorld } from '../replay/hash';
import { stepBullets } from '../weapons/guns';
import { createWorld, stepWorld, type World } from '../world/world';
import { slotPosition } from './formation';
import { livingWingmen } from './squadron';
import { createWingman, stepWingmen } from './wingmen';

const DT = 1 / 60;

/** An empty arena: no waves, no drones or turrets, so each test controls what exists. */
function arena(wingmen = 2) {
  const tuning = createTuning();
  tuning.fighter.waveSize = 0;
  tuning.arena.staticCount = 0;
  tuning.arena.droneCount = 0;
  tuning.arena.turretCount = 0;
  tuning.squadron.wingmanCount = wingmen;
  return createWorld(1, tuning);
}

/** Steps the whole world; the player flies straight at cruise speed unless a test says otherwise. */
function steps(world: World, seconds: number): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) stepWorld(world, DT);
}

/** Runs only the wingman logic (everything else stands still). */
function wingSteps(world: World, n = 1): void {
  for (let i = 0; i < n; i++) {
    world.tick += 1;
    world.time += DT;
    stepWingmen(world);
  }
}

const slotOf = (world: World, i: number) => {
  const count = world.tuning.squadron.wingmanCount;
  return slotPosition(
    { x: 0, y: 0 },
    world.squadron.formation,
    i,
    count,
    world.ship,
    world.tuning.squadron,
  );
};

describe('creation', () => {
  it('creates wingmanCount wingmen on their slots, flying the player velocity', () => {
    const world = arena(3);
    expect(world.squadron.wingmen).toHaveLength(0);
    steps(world, DT);
    expect(world.squadron.wingmen).toHaveLength(3);
    expect(livingWingmen(world.squadron)).toBe(3);
    world.squadron.wingmen.forEach((w, i) => {
      const slot = slotOf(world, i);
      expect(Math.hypot(w.ship.x - slot.x, w.ship.y - slot.y)).toBeLessThan(40);
      expect(w.hp).toBe(world.tuning.squadron.health);
    });
  });

  it('follows wingmanCount live: grows, shrinks, and 0 means none', () => {
    const world = arena(2);
    steps(world, DT);
    world.tuning.squadron.wingmanCount = 4;
    steps(world, DT);
    expect(world.squadron.wingmen).toHaveLength(4);
    world.tuning.squadron.wingmanCount = 1;
    steps(world, DT);
    expect(world.squadron.wingmen).toHaveLength(1);
    world.tuning.squadron.wingmanCount = 0;
    steps(world, DT);
    expect(world.squadron.wingmen).toHaveLength(0);
  });

  it('are re-created after a respawn', () => {
    const world = arena(2);
    steps(world, 2);
    world.squadron.wingmen[0]!.hp = 1;
    world.actions.respawn = true;
    stepWorld(world, DT);
    world.actions.respawn = false;
    expect(world.squadron.wingmen).toHaveLength(2);
    expect(
      world.squadron.wingmen.every((w) => w.alive && w.hp === world.tuning.squadron.health),
    ).toBe(true);
  });
});

describe('holding formation', () => {
  it('keeps its slot while the player flies straight', () => {
    for (const formation of ['tight', 'spread'] as const) {
      const world = arena(3);
      world.squadron.formation = formation;
      steps(world, 20);
      world.squadron.wingmen.forEach((w, i) => {
        const slot = slotOf(world, i);
        expect(Math.hypot(w.ship.x - slot.x, w.ship.y - slot.y), `${formation} #${i}`).toBeLessThan(
          2 * world.tuning.squadron.slotHoldRadius,
        );
      });
    }
  });

  it('keeps up through the player turns (stays close, never flies off)', () => {
    const world = arena(2);
    steps(world, 2);
    world.actions.rotate = 1;
    steps(world, 4);
    world.actions.rotate = -1;
    steps(world, 4);
    world.actions.rotate = 0;
    steps(world, 4);
    for (const w of world.squadron.wingmen) {
      expect(Math.hypot(w.ship.x - world.ship.x, w.ship.y - world.ship.y)).toBeLessThan(900);
    }
  });

  it('matches the player speed', () => {
    const world = arena(2);
    world.actions.throttle = 1;
    steps(world, 5);
    world.actions.throttle = 0;
    steps(world, 15);
    for (const w of world.squadron.wingmen) {
      expect(Math.abs(w.ship.speed - world.ship.speed)).toBeLessThan(40);
    }
  });
});

describe('separation', () => {
  it('pushes a wingman that is too close to the player away from it', () => {
    const steerWithGain = (gain: number): number => {
      const world = arena(1);
      world.tuning.squadron.separationGain = gain;
      world.ship.vx = 0;
      world.ship.vy = 0;
      world.squadron.wingmen.push(createWingman(world, 0, 1));
      const w = world.squadron.wingmen[0]!;
      w.ship.x = world.ship.x + 50; // 50 u ahead of the player: inside the 120 u separation
      w.ship.y = world.ship.y;
      wingSteps(world, 1);
      return w.actions.steerX;
    };
    // Its slot is behind the player (to the west); the push away from the player is to the east.
    expect(steerWithGain(1.5)).toBeGreaterThan(steerWithGain(0));
  });

  it('pushes two wingmen that are too close apart from each other', () => {
    const world = arena(2);
    world.tuning.squadron.separationGain = 3;
    world.ship.vx = 0;
    world.ship.vy = 0;
    world.squadron.formation = 'spread';
    world.squadron.wingmen.push(createWingman(world, 0, 2), createWingman(world, 1, 2));
    const [a, b] = world.squadron.wingmen as [
      (typeof world.squadron.wingmen)[number],
      (typeof world.squadron.wingmen)[number],
    ];
    a.ship.x = 400;
    a.ship.y = 0;
    b.ship.x = 400;
    b.ship.y = 60; // 60 u above a
    wingSteps(world, 1);
    // a should be steered away from b (downwards), b away from a (upwards), relative to no push.
    expect(a.actions.steerY).toBeLessThan(b.actions.steerY);
  });

  /** Smallest wingman-to-wingman distance now, and a callback-free way to run a manoeuvre. */
  const closestPair = (world: World): number => {
    const ws = world.squadron.wingmen;
    let closest = Infinity;
    for (let p = 0; p < ws.length; p++) {
      for (let q = p + 1; q < ws.length; q++) {
        closest = Math.min(
          closest,
          Math.hypot(ws[p]!.ship.x - ws[q]!.ship.x, ws[p]!.ship.y - ws[q]!.ship.y),
        );
      }
    }
    return closest;
  };

  it('wingmen never overlap during straight flight and gentle turns', () => {
    const world = arena(4);
    world.squadron.formation = 'tight';
    let closest = Infinity;
    for (let i = 0; i < 60 * 30; i++) {
      world.actions.rotate = i >= 60 * 5 && i < 60 * 8 ? 0.3 : 0;
      stepWorld(world, DT);
      closest = Math.min(closest, closestPair(world));
    }
    expect(closest).toBeGreaterThan(world.tuning.squadron.radius);
  });

  it('after a hard spin they may cross paths but never stay stacked, and the formation re-forms', () => {
    const world = arena(4);
    world.squadron.formation = 'tight';
    let overlappedFor = 0;
    let longestOverlap = 0;
    // 22 s in total: stops well before the player reaches the arena edge and is turned back.
    for (let i = 0; i < 60 * 22; i++) {
      world.actions.rotate = i >= 60 * 5 && i < 60 * 8 ? 1 : 0; // three seconds at full turn rate
      stepWorld(world, DT);
      overlappedFor = closestPair(world) < world.tuning.squadron.radius ? overlappedFor + 1 : 0;
      longestOverlap = Math.max(longestOverlap, overlappedFor);
    }
    expect(longestOverlap).toBeLessThan(90); // under 1.5 s, never "stuck"
    // 14 s of calm flying later every wingman is back near its slot.
    world.squadron.wingmen.forEach((w, i) => {
      const slot = slotOf(world, i);
      expect(Math.hypot(w.ship.x - slot.x, w.ship.y - slot.y)).toBeLessThan(
        2 * world.tuning.squadron.slotHoldRadius,
      );
    });
  });
});

describe('engagement', () => {
  /** A stationary-ish enemy fighter at a spot, with the player at the origin. */
  const enemyAt = (world: World, x: number, y: number) => {
    const i = spawnFighter(world, x, y, 0);
    const f = world.fighters[i]!;
    f.ship.speed = 0;
    f.vx = 0;
    f.vy = 0;
    return i;
  };

  it('tight: engages only enemies near the player', () => {
    const world = arena(1);
    world.ship.vx = 0;
    world.ship.vy = 0;
    world.squadron.wingmen.push(createWingman(world, 0, 1));
    const w = world.squadron.wingmen[0]!;
    const near = enemyAt(world, world.tuning.squadron.tightEngageRange - 100, 0);
    wingSteps(world, 1);
    expect(w.engagedId).toBe(1000 + near);
    world.fighters[near]!.alive = false;
    enemyAt(world, world.tuning.squadron.tightEngageRange + 400, 0);
    wingSteps(world, 1);
    expect(w.engagedId).toBe(-1); // too far from the player
  });

  it('spread: engages anything within range of itself, even far from the player', () => {
    const world = arena(1);
    world.ship.vx = 0;
    world.ship.vy = 0;
    world.squadron.formation = 'spread';
    world.squadron.wingmen.push(createWingman(world, 0, 1));
    const w = world.squadron.wingmen[0]!;
    // The wingman sits on the ring due east of the player; an enemy 2000 u from the player
    // but only 1100 - 100 u from the wingman is in range.
    const wx = w.ship.x;
    const id = enemyAt(world, wx + world.tuning.squadron.spreadEngageRange - 100, 0);
    wingSteps(world, 1);
    expect(w.engagedId).toBe(1000 + id);
    expect(Math.hypot(world.fighters[id]!.x - world.ship.x, 0)).toBeGreaterThan(
      world.tuning.squadron.tightEngageRange,
    );
  });

  it('ignores static targets', () => {
    const world = arena(1);
    world.tuning.arena.staticCount = 0;
    world.squadron.wingmen.push(createWingman(world, 0, 1));
    world.targets.push({
      kind: 'static',
      mode: 'static',
      x: 300,
      y: 0,
      radius: 30,
      hp: 3,
      maxHp: 3,
      alive: true,
      homeX: 300,
      homeY: 0,
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
    });
    wingSteps(world, 1);
    expect(world.squadron.wingmen[0]!.engagedId).toBe(-1);
  });

  it('returns to its slot after the enemy is gone', () => {
    const world = arena(1);
    world.squadron.wingmen.push(createWingman(world, 0, 1));
    const w = world.squadron.wingmen[0]!;
    const id = enemyAt(world, 400, 0);
    wingSteps(world, 1);
    expect(w.engagedId).toBe(1000 + id);
    world.fighters[id]!.alive = false;
    wingSteps(world, 1);
    expect(w.engagedId).toBe(-1);
  });

  it('shoots at an enemy in its cone and range with reduced damage; friendly bullets never hurt friends', () => {
    const world = arena(1);
    const cfg = world.tuning.squadron;
    cfg.spread = 0;
    world.ship.vx = 0;
    world.ship.vy = 0;
    world.squadron.wingmen.push(createWingman(world, 0, 1));
    const w = world.squadron.wingmen[0]!;
    w.ship.x = -200;
    w.ship.y = 0;
    w.ship.heading = 0; // facing east, toward the enemy
    const id = enemyAt(world, 300, 0);
    wingSteps(world, 1);
    expect(world.bullets.count).toBe(1);
    expect(world.bullets.data.damage[0]).toBeCloseTo(cfg.gunDamage);
    expect(cfg.gunDamage).toBeLessThan(world.tuning.weapons.bulletDamage);
    expect(w.fireCooldown).toBeCloseTo(1 / cfg.fireRate, 3);
    // The bullet damages the enemy by gunDamage, and leaves the wingman and the player alone.
    const f = world.fighters[id]!;
    const hp = f.hp;
    for (let i = 0; i < 80 && world.bullets.count > 0; i++) {
      stepBullets(
        world.bullets,
        world.targets,
        world.tuning.weapons,
        world.events,
        DT,
        world.fighters,
      );
    }
    expect(f.hp).toBeCloseTo(hp - cfg.gunDamage);
    expect(w.hp).toBe(cfg.health);
  });

  it('does not shoot out of range', () => {
    const world = arena(1);
    world.ship.vx = 0;
    world.ship.vy = 0;
    world.squadron.formation = 'spread';
    world.squadron.wingmen.push(createWingman(world, 0, 1));
    const w = world.squadron.wingmen[0]!;
    w.ship.heading = 0;
    enemyAt(world, w.ship.x + world.tuning.squadron.fireRange + 150, 0);
    wingSteps(world, 3);
    expect(world.bullets.count).toBe(0);
  });
});

describe('losses', () => {
  const shotAt = (world: World, x: number, y: number) => {
    const k = world.enemyShots.spawn();
    world.enemyShots.data.x[k] = x;
    world.enemyShots.data.y[k] = y;
    world.enemyShots.data.vx[k] = 100;
    world.enemyShots.data.life[k] = 2;
  };

  it('an enemy bullet hits a wingman once: hp down, shot used up, Hit event', () => {
    const world = arena(1);
    world.squadron.wingmen.push(createWingman(world, 0, 1));
    const w = world.squadron.wingmen[0]!;
    shotAt(world, w.ship.x, w.ship.y);
    wingSteps(world, 1);
    expect(w.hp).toBe(world.tuning.squadron.health - 1);
    expect(world.enemyShots.count).toBe(0);
    expect(world.events.events.filter((e) => e.type === 'Hit')).toHaveLength(1);
    expect(w.alive).toBe(true);
  });

  it('is shot down at 0 hp: one Killed event of kind wingman, no longer counted, and out of the fight', () => {
    const world = arena(1);
    world.squadron.wingmen.push(createWingman(world, 0, 1));
    const w = world.squadron.wingmen[0]!;
    for (let k = 0; k < world.tuning.squadron.health; k++) shotAt(world, w.ship.x, w.ship.y);
    wingSteps(world, 1);
    expect(w.alive).toBe(false);
    const killed = world.events.events.filter((e) => e.type === 'Killed');
    expect(killed).toHaveLength(1);
    expect(killed[0]).toMatchObject({ kind: 'wingman', entityId: 0 });
    expect(livingWingmen(world.squadron)).toBe(0);
    const x = w.ship.x;
    wingSteps(world, 5);
    expect(w.ship.x).toBe(x); // a downed wingman does not fly
  });

  it('returns after the respawn delay at full health, near the player', () => {
    const world = arena(1);
    world.squadron.wingmen.push(createWingman(world, 0, 1));
    const w = world.squadron.wingmen[0]!;
    w.hp = 0;
    w.alive = false;
    w.respawnTimer = world.tuning.squadron.respawnDelay;
    wingSteps(world, Math.floor((world.tuning.squadron.respawnDelay - 0.5) / DT));
    expect(w.alive).toBe(false);
    // Step until it returns, and look at it that very step (the test's player is not flying, so a
    // returned wingman would otherwise fly off its slot).
    for (let i = 0; i < Math.ceil(1 / DT) && !w.alive; i++) wingSteps(world, 1);
    expect(w.alive).toBe(true);
    expect(w.hp).toBe(world.tuning.squadron.health);
    const slot = slotOf(world, 0);
    expect(Math.hypot(w.ship.x - slot.x, w.ship.y - slot.y)).toBeLessThan(60);
  });

  it('enemy fighters stop chasing a wingman that is down', () => {
    const world = arena(1);
    world.squadron.wingmen.push(createWingman(world, 0, 1));
    const w = world.squadron.wingmen[0]!;
    w.alive = false;
    w.respawnTimer = 99;
    const i = spawnFighter(world, 600, 0, Math.PI);
    world.fighters[i]!.targetIndex = 0;
    world.tick += 1;
    world.time += DT;
    stepFighters(world);
    // The fighter re-picks at once because its wingman target is gone: it chases the player.
    expect(world.fighters[i]!.targetIndex).toBe(-1);
  });
});

describe('determinism and the replay hash', () => {
  it('the same seed gives the same wingmen', () => {
    const run = () => {
      const w = createWorld(33, createTuning());
      for (let s = 0; s < 60 * 20; s++) stepWorld(w, DT);
      return hashWorld(w);
    };
    expect(run()).toBe(run());
  });

  it('every wingman field is part of the hash', () => {
    const world = arena(1);
    world.squadron.wingmen.push(createWingman(world, 0, 1));
    const w = world.squadron.wingmen[0]!;
    const changes: Array<[string, () => void]> = [
      ['x', () => (w.ship.x += 1)],
      ['heading', () => (w.ship.heading += 0.1)],
      ['speed', () => (w.ship.speed += 1)],
      ['evadeTimer', () => (w.ship.evadeTimer += 0.1)],
      ['hp', () => (w.hp -= 1)],
      ['alive', () => (w.alive = false)],
      ['fireCooldown', () => (w.fireCooldown += 0.1)],
      ['engagedId', () => (w.engagedId = 1003)],
      ['respawnTimer', () => (w.respawnTimer += 1)],
    ];
    let previous = hashWorld(world);
    for (const [name, change] of changes) {
      change();
      const now = hashWorld(world);
      expect(now, `${name} must be part of the replay hash`).not.toBe(previous);
      previous = now;
    }
  });
});
