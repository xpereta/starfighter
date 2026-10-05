import { describe, expect, it } from 'vitest';
import { createFighterConfig } from '../../../data/tuning/fighter';
import { createTuning } from '../../../data/tuning';
import { hashWorld } from '../replay/hash';
import { stepMissiles } from '../weapons/missiles';
import { FIGHTER_ID_BASE } from '../world/lockable';
import { createWorld, type World } from '../world/world';
import { stepFighters } from './fighters';
import {
  awarenessChance,
  PLAN_DONE,
  PLAN_IGNORE,
  PLAN_REACT,
  reactionTrigger,
  timeToImpact,
} from './missile-evasion';
import { spawnFighter } from './waves';

const DT = 1 / 60;

describe('awarenessChance', () => {
  const cfg = createFighterConfig();
  it('is the full chance right next to the fighter and drops by the far penalty at the range edge', () => {
    expect(awarenessChance(cfg, 0)).toBeCloseTo(cfg.missileEvadeChance);
    expect(awarenessChance(cfg, cfg.missileDetectRange)).toBeCloseTo(
      cfg.missileEvadeChance * (1 - cfg.missileFarPenalty),
    );
  });
  it('falls monotonically with distance and clamps beyond the range', () => {
    const a = awarenessChance(cfg, 200);
    const b = awarenessChance(cfg, 800);
    expect(a).toBeGreaterThan(b);
    expect(awarenessChance(cfg, 1e6)).toBeCloseTo(awarenessChance(cfg, cfg.missileDetectRange));
  });
  it('is 0 when the chance is 0', () => {
    expect(awarenessChance({ ...cfg, missileEvadeChance: 0 }, 300)).toBe(0);
  });
});

describe('reactionTrigger and timeToImpact', () => {
  it('the ideal trigger is the middle of the i-frame window; the error shifts it', () => {
    expect(reactionTrigger(0.3, 0)).toBeCloseTo(0.15);
    expect(reactionTrigger(0.3, 0.2)).toBeCloseTo(0.35);
    expect(reactionTrigger(0.3, -0.2)).toBeCloseTo(-0.05);
  });
  it('time to impact is distance over closing speed', () => {
    // Missile 600 u to the left of the fighter, flying right at 600 u/s, fighter still.
    expect(timeToImpact(-600, 0, 600, 0)).toBeCloseTo(1);
    // The fighter flying toward it adds to the closing speed.
    expect(timeToImpact(-600, 0, 900, 0)).toBeCloseTo(600 / 900);
  });
  it('is Infinity when the missile is not closing, 0 when on top of it', () => {
    expect(timeToImpact(-600, 0, -50, 0)).toBe(Infinity);
    expect(timeToImpact(-600, 0, 0, 100)).toBe(Infinity);
    expect(timeToImpact(0, 0, 10, 10)).toBe(0);
  });
});

/** One fighter at the origin heading away from the player, one missile homing on it from the left. */
function scene(tweak?: (w: World) => void) {
  const tuning = createTuning();
  tuning.fighter.waveSize = 0;
  tuning.squadron.wingmanCount = 0;
  tuning.fighter.missileEvadeChance = 1;
  tuning.fighter.missileFarPenalty = 0;
  tuning.fighter.missileReactionError = 0;
  const world = createWorld(5, tuning);
  world.ship.x = 3000; // far from the fighter: it is not shot at, nothing else interferes
  world.ship.y = 0;
  tweak?.(world);
  const k = spawnFighter(world, 0, 0, 0, 100);
  const f = world.fighters[k]!;
  f.hp = f.maxHp = f.lastHp = 1000;
  return { world, f, k };
}

function addMissile(world: World, x: number, targetId: number, uid = 0): number {
  const m = world.missiles;
  const i = m.spawn();
  m.data.uid[i] = uid;
  m.data.x[i] = x;
  m.data.y[i] = 0;
  m.data.heading[i] = 0;
  m.data.speed[i] = 750;
  m.data.phase[i] = 0;
  m.data.vx[i] = 750;
  m.data.vy[i] = 0;
  m.data.life[i] = 4;
  m.data.targetId[i] = targetId;
  m.data.owner[i] = 0;
  m.data.damageScale[i] = 1;
  return i;
}

function ai(world: World, n = 1): void {
  for (let i = 0; i < n; i++) {
    world.tick += 1;
    world.time += DT;
    stepFighters(world);
  }
}

describe('a fighter noticing a missile', () => {
  it('ignores a missile outside the detection range or homing on something else', () => {
    const { world, f, k } = scene();
    const range = world.tuning.fighter.missileDetectRange;
    addMissile(world, -range - 200, FIGHTER_ID_BASE + k, 1);
    addMissile(world, -300, FIGHTER_ID_BASE + k + 5, 2);
    ai(world, 3);
    expect(f.missileUid).toBe(-1);
    expect(f.missilePlan).toBe(PLAN_IGNORE);
    expect(f.ship.evadeTimer).toBe(0);
  });

  it('with chance 1 and no error, rolls when the impact is within the i-frame window', () => {
    const { world, f, k } = scene();
    addMissile(world, -900, FIGHTER_ID_BASE + k, 7);
    ai(world, 1);
    expect(f.missileUid).toBe(7);
    expect(f.missilePlan).toBe(PLAN_REACT); // noticed, waiting for the right moment
    expect(f.ship.evadeTimer).toBe(0); // far away: no roll yet
    // Fly the missile in by hand until about 0.1 s out, then step the AI once.
    world.missiles.data.x[0] = -(750 - f.vx) * 0.1;
    ai(world, 1);
    expect(f.missilePlan).toBe(PLAN_DONE);
    expect(f.ship.evadeTimer).toBeGreaterThan(0);
    expect(f.missileCooldown).toBeCloseTo(world.tuning.fighter.missileEvadeCooldown, 3);
  });

  it('a 0% awareness roll never reacts', () => {
    const { world, f, k } = scene((w) => {
      w.tuning.fighter.missileEvadeChance = 0;
    });
    addMissile(world, -900, FIGHTER_ID_BASE + k);
    ai(world, 1);
    world.missiles.data.x[0] = -50;
    ai(world, 2);
    expect(f.missilePlan).toBe(PLAN_IGNORE);
    expect(f.ship.evadeTimer).toBe(0);
  });

  it('the master toggle off means no reaction at all', () => {
    const { world, f, k } = scene((w) => {
      w.tuning.fighter.enemiesEvadeMissiles = false;
    });
    addMissile(world, -900, FIGHTER_ID_BASE + k);
    ai(world, 1);
    world.missiles.data.x[0] = -50;
    ai(world, 2);
    expect(f.missileUid).toBe(-1);
    expect(f.ship.evadeTimer).toBe(0);
  });

  it('a missile that arrives while the missile cooldown runs is not dodged', () => {
    const { world, f, k } = scene();
    f.missileCooldown = 1.5;
    addMissile(world, -900, FIGHTER_ID_BASE + k);
    ai(world, 1);
    world.missiles.data.x[0] = -50;
    ai(world, 2);
    expect(f.missilePlan).toBe(PLAN_DONE); // it tried, but could not
    expect(f.ship.evadeTimer).toBe(0);
  });

  it('decides each missile once: a second missile gets its own decision', () => {
    const { world, f, k } = scene();
    addMissile(world, -900, FIGHTER_ID_BASE + k, 1);
    ai(world, 1);
    expect(f.missileUid).toBe(1);
    world.missiles.remove(0);
    addMissile(world, -800, FIGHTER_ID_BASE + k, 2);
    ai(world, 1);
    expect(f.missileUid).toBe(2);
    expect(f.missilePlan).toBe(PLAN_REACT);
  });

  it('is deterministic and the state is in the hash', () => {
    const run = () => {
      const { world, f, k } = scene((w) => {
        w.tuning.fighter.missileEvadeChance = 0.5;
        w.tuning.fighter.missileReactionError = 0.2;
      });
      addMissile(world, -900, FIGHTER_ID_BASE + k);
      ai(world, 5);
      return { world, f };
    };
    const a = run();
    const b = run();
    expect(hashWorld(a.world)).toBe(hashWorld(b.world));
    const before = hashWorld(a.world);
    a.f.missilePlan += 1;
    expect(hashWorld(a.world)).not.toBe(before);
  });
});

describe('a missile against an immune (rolling) fighter', () => {
  it('flies through it, loses its lock and does no damage; nothing goes NaN', () => {
    const { world, f, k } = scene();
    f.immune = true;
    f.ship.invulnerable = true;
    addMissile(world, -20, FIGHTER_ID_BASE + k);
    stepMissiles(world);
    expect(f.hp).toBe(1000);
    expect(world.missiles.count).toBe(1);
    expect(world.missiles.data.targetId[0]).toBe(-1);
    for (let i = 0; i < 120; i++) stepMissiles(world);
    const d = world.missiles.data;
    expect(Number.isFinite(d.x[0]! + d.y[0]! + d.heading[0]! + d.vx[0]!)).toBe(true);
    expect(f.hp).toBe(1000);
  });

  it('hits the same fighter normally when it is not immune', () => {
    const { world, f, k } = scene();
    addMissile(world, -20, FIGHTER_ID_BASE + k);
    stepMissiles(world);
    expect(f.hp).toBe(1000 - world.tuning.missiles.missileDamage);
    expect(world.missiles.count).toBe(0);
  });
});
