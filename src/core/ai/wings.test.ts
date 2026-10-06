import { describe, expect, it } from 'vitest';
import { WING_CUE } from '../../../data/content/cues';
import { createTuning } from '../../../data/tuning';
import { WING_SHAPES } from '../enemies/state';
import { hashWorld } from '../replay/hash';
import { FIGHTER_ID_BASE } from '../world/lockable';
import { createWorld, stepWorld, type World } from '../world/world';
import { stepFighters } from './fighters';
import { spawnGunship } from './gunship';
import { spawnBattleWave } from './waves';
import {
  breakReason,
  inFormation,
  isLeader,
  slotOffset,
  slotWorld,
  spawnWing,
  stepWings,
  wingCue,
  type SlotOffset,
} from './wings';

const DT = 1 / 60;

/** A world with no waves and the player parked far from the action at (px, 0). */
function arena(px = -5500): World {
  const tuning = createTuning();
  tuning.fighter.waveSize = 0;
  const world = createWorld(1, tuning);
  world.ship.x = px;
  world.ship.vx = 0;
  world.ship.vy = 0;
  return world;
}

function aiSteps(world: World, n = 1): void {
  for (let i = 0; i < n; i++) {
    world.tick += 1;
    world.time += DT;
    stepFighters(world);
  }
}

const offsets = (shape: (typeof WING_SHAPES)[number], n: number, r = 140): SlotOffset[] =>
  Array.from({ length: n }, (_, i) => ({ ...slotOffset({ x: 0, y: 0 }, shape, i, r) }));

describe('formation slots', () => {
  it('a V puts the first two followers behind-left and behind-right, then further back and out', () => {
    const [a, b, c, d] = offsets('v', 4);
    expect(a!.x).toBeLessThan(0);
    expect(a!.y).toBeGreaterThan(0);
    expect(b!.x).toBe(a!.x);
    expect(b!.y).toBe(-a!.y);
    expect(c!.x).toBeLessThan(a!.x);
    expect(Math.abs(c!.y)).toBeGreaterThan(Math.abs(a!.y));
    expect(d!.y).toBe(-c!.y);
  });

  it('a line is abreast of the leader and a box wraps it', () => {
    for (const s of offsets('line', 4)) expect(s.x).toBe(0);
    const box = offsets('box', 4);
    expect(box.filter((s) => s.x > 0)).toHaveLength(2);
    expect(box.filter((s) => s.x < 0)).toHaveLength(2);
    expect(box.filter((s) => s.y > 0)).toHaveLength(2);
  });

  it.each(WING_SHAPES)(
    '%s: no two slots (leader included) overlap, up to the biggest wing',
    (shape) => {
      const pts = [{ x: 0, y: 0 }, ...offsets(shape, 4)];
      for (let i = 0; i < pts.length; i++)
        for (let j = i + 1; j < pts.length; j++) {
          const d = Math.hypot(pts[i]!.x - pts[j]!.x, pts[i]!.y - pts[j]!.y);
          expect(d, `${shape} ${i}-${j}`).toBeGreaterThan(2 * 28 + 20);
        }
    },
  );

  it('the slot radius scales the whole formation', () => {
    const small = slotOffset({ x: 0, y: 0 }, 'v', 1, 100);
    const big = slotOffset({ x: 0, y: 0 }, 'v', 1, 200);
    expect(big.x).toBeCloseTo(small.x * 2);
    expect(big.y).toBeCloseTo(small.y * 2);
  });

  it('slotWorld turns the offset with the leader heading and moves it to the leader', () => {
    const out = { x: 0, y: 0 };
    slotWorld(out, { x: 10, y: 20, heading: 0 }, { x: -100, y: 50 });
    expect(out).toEqual({ x: -90, y: 70 });
    slotWorld(out, { x: 10, y: 20, heading: Math.PI / 2 }, { x: -100, y: 50 });
    expect(out.x).toBeCloseTo(-40);
    expect(out.y).toBeCloseTo(-80);
  });
});

describe('break rules', () => {
  const calm = { leaderAlive: true, anyHit: false, playerDistance: 2000, breakProximity: 500 };
  it('holds while the leader lives, nobody is hit and the player is far', () => {
    expect(breakReason(calm)).toBeNull();
  });
  it('breaks when the leader dies, a member takes fire, or the player gets close', () => {
    expect(breakReason({ ...calm, leaderAlive: false })).toBe('leader');
    expect(breakReason({ ...calm, anyHit: true })).toBe('fire');
    expect(breakReason({ ...calm, playerDistance: 500 })).toBe('proximity');
    expect(breakReason({ ...calm, playerDistance: 501 })).toBeNull();
  });
  it('the leader dying wins over fire and closeness, fire over closeness', () => {
    expect(
      breakReason({ leaderAlive: false, anyHit: true, playerDistance: 1, breakProximity: 500 }),
    ).toBe('leader');
    expect(breakReason({ ...calm, anyHit: true, playerDistance: 1 })).toBe('fire');
  });
});

describe('spawning a wing', () => {
  it.each([3, 4, 5])('a wing of %i: a sturdier leader and followers on their slots', (size) => {
    const world = arena();
    world.tuning.wings.size = size;
    world.tuning.wings.shape = 'v';
    const events: string[] = [];
    const emit = world.events.emit;
    world.events.emit = (e) => {
      if (e.type === 'EnemySpawned') events.push(e.kind);
      emit(e);
    };
    const id = spawnWing(world, 3000, 0, Math.PI);
    const wing = world.enemies.wings[id]!;
    expect(world.fighters).toHaveLength(size);
    expect(wing.members).toHaveLength(size - 1);
    expect(events).toHaveLength(size);
    const leader = world.fighters[wing.leader]!;
    const base = world.tuning.fighter.health;
    expect(leader.hp).toBe(base + world.tuning.wings.leaderExtraHp);
    expect(leader.maxHp).toBe(leader.hp);
    const slot = { x: 0, y: 0 };
    wing.members.forEach((m, k) => {
      const f = world.fighters[m]!;
      expect(f.hp).toBe(base);
      expect(f.wingId).toBe(id);
      expect(f.wingSlot).toBe(k);
      slotWorld(
        slot,
        { x: 3000, y: 0, heading: Math.PI },
        slotOffset({ x: 0, y: 0 }, 'v', k, world.tuning.wings.slotRadius),
      );
      expect(f.x).toBeCloseTo(slot.x);
      expect(f.y).toBeCloseTo(slot.y);
      expect(f.ship.heading).toBeCloseTo(Math.PI);
    });
    expect(isLeader(world, leader, wing.leader)).toBe(true);
    expect(inFormation(world, world.fighters[wing.members[0]!]!)).toBe(true);
  });

  it('the shape setting forces a formation, mixed picks one from the seeded rng', () => {
    const world = arena();
    world.tuning.wings.shape = 'box';
    expect(world.enemies.wings[spawnWing(world, 0, 0, 0)]!.shape).toBe('box');
    world.tuning.wings.shape = 'mixed';
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) seen.add(world.enemies.wings[spawnWing(world, 0, 0, 0)]!.shape);
    expect(seen.size).toBe(3);
  });

  it('a battle wave spawns the asked number of wings, around the edge', () => {
    const world = arena();
    spawnBattleWave(world, { groups: [{ kind: 'wing', count: 2 }] });
    expect(world.enemies.wings).toHaveLength(2);
    expect(world.fighters).toHaveLength(2 * world.tuning.wings.size);
    const ring = world.tuning.flight.arenaRadius * world.tuning.fighter.spawnFraction;
    for (const w of world.enemies.wings) {
      const l = world.fighters[w.leader]!;
      expect(Math.hypot(l.x, l.y)).toBeCloseTo(ring, 0);
    }
  });
});

describe('breaking formation', () => {
  function wingWorld(): { world: World; wing: ReturnType<typeof getWing> } {
    const world = arena();
    world.tuning.wings.shape = 'v';
    spawnWing(world, 3000, 0, Math.PI);
    return { world, wing: getWing(world) };
  }
  const getWing = (w: World) => w.enemies.wings[0]!;
  const brokenEvents = (world: World): string[] => {
    const out: string[] = [];
    const emit = world.events.emit;
    world.events.emit = (e) => {
      if (e.type === 'WingBroken') out.push(e.reason);
      emit(e);
    };
    return out;
  };

  it('holds while nothing happens', () => {
    const { world, wing } = wingWorld();
    const seen = brokenEvents(world);
    stepWings(world);
    aiSteps(world, 120);
    expect(wing.broken).toBe(false);
    expect(seen).toEqual([]);
  });

  it('breaks, once, when the leader dies', () => {
    const { world, wing } = wingWorld();
    const seen = brokenEvents(world);
    world.fighters[wing.leader]!.alive = false;
    aiSteps(world, 5);
    expect(wing.broken).toBe(true);
    expect(seen).toEqual(['leader']);
    for (const m of wing.members) expect(inFormation(world, world.fighters[m]!)).toBe(false);
  });

  it('breaks when a follower takes fire, and when the leader does', () => {
    for (const who of ['follower', 'leader'] as const) {
      const { world, wing } = wingWorld();
      const seen = brokenEvents(world);
      const f = world.fighters[who === 'leader' ? wing.leader : wing.members[1]!]!;
      f.hp -= 1;
      aiSteps(world, 1);
      expect(wing.broken, who).toBe(true);
      expect(seen, who).toEqual(['fire']);
    }
  });

  it('breaks when the player gets close to any member, not before', () => {
    const { world, wing } = wingWorld();
    const seen = brokenEvents(world);
    const f = world.fighters[wing.members[2]!]!;
    world.ship.x = f.x + (world.tuning.wings.breakProximity + 50); // behind the formation (it flies towards -x)
    world.ship.y = f.y;
    aiSteps(world, 1);
    expect(wing.broken).toBe(false);
    world.ship.x = f.x + (world.tuning.wings.breakProximity - 50);
    aiSteps(world, 1);
    expect(wing.broken).toBe(true);
    expect(seen).toEqual(['proximity']);
  });

  it('after the break the fighters retarget at once and fly as ordinary fighters', () => {
    const { world, wing } = wingWorld();
    for (const m of wing.members) world.fighters[m]!.retargetTimer = 99;
    world.fighters[wing.leader]!.alive = false;
    aiSteps(world, 1);
    for (const m of wing.members) expect(world.fighters[m]!.retargetTimer).toBeLessThan(5);
  });

  it('a slot reused by a later spawn is not counted as a member', () => {
    const { world, wing } = wingWorld();
    const m = wing.members[0]!;
    world.fighters[m]!.hp = 0;
    world.fighters[m]!.alive = false;
    const g = spawnGunship(world, 0, 3000, 0); // takes the dead slot, wingId -1
    expect(g).toBe(m);
    world.fighters[g]!.hp -= 1; // a hit on the gunship must not break the wing
    aiSteps(world, 2);
    expect(wing.broken).toBe(false);
  });

  it('a leader of an intact wing does not break away when the player locks it', () => {
    const { world, wing } = wingWorld();
    world.lockon.locks.push(FIGHTER_ID_BASE + wing.leader);
    aiSteps(world, 5);
    expect(world.fighters[wing.leader]!.breakTimer).toBe(0);
  });
});

describe('flying in formation', () => {
  it('followers stay near their slots while the leader flies at a distant player', () => {
    const world = arena();
    world.tuning.wings.shape = 'v';
    const id = spawnWing(world, 3000, 0, Math.PI);
    const wing = world.enemies.wings[id]!;
    const leader = world.fighters[wing.leader]!;
    const slot = { x: 0, y: 0 };
    let worst = 0;
    for (let i = 0; i < 60 * 8; i++) {
      aiSteps(world);
      wing.members.forEach((m, k) => {
        const f = world.fighters[m]!;
        slotWorld(
          slot,
          leader.ship,
          slotOffset({ x: 0, y: 0 }, wing.shape, k, world.tuning.wings.slotRadius),
        );
        worst = Math.max(worst, Math.hypot(f.x - slot.x, f.y - slot.y));
      });
    }
    expect(wing.broken).toBe(false);
    expect(worst).toBeLessThan(world.tuning.wings.slotRadius * 1.5);
    expect(Math.hypot(leader.x, leader.y)).toBeLessThan(3000); // the leader did fly
  });

  it('followers shoot at the leader target from the formation', () => {
    const world = arena(-700);
    world.tuning.wings.breakProximity = 100; // keep the formation while it fires
    spawnWing(world, 200, 0, Math.PI);
    let shots = 0;
    const emit = world.events.emit;
    world.events.emit = (e) => {
      if (e.type === 'EnemyShotFired') shots++;
      emit(e);
    };
    aiSteps(world, 60 * 3);
    expect(shots).toBeGreaterThan(20); // the leader alone could fire at most about 12 in 3 s
  });

  it('is deterministic: the same wing fight twice gives the same hash', () => {
    const run = (): string => {
      const w = createWorld(5, createTuning());
      w.tuning.fighter.waveSize = 0;
      spawnWing(w, 2500, 300, Math.PI);
      for (let k = 0; k < 60 * 12; k++) stepWorld(w, DT);
      return hashWorld(w);
    };
    expect(run()).toBe(run());
  });
});

describe('the WING INBOUND cue', () => {
  it('shows while a fresh wing holds formation, then goes away with time or the break', () => {
    const world = arena();
    expect(wingCue(world)).toBeNull();
    spawnWing(world, 3000, 0, Math.PI);
    expect(wingCue(world)).toBe(WING_CUE);
    world.time += world.tuning.wings.cueTime + 0.1;
    expect(wingCue(world)).toBeNull();
    world.time = 0;
    world.enemies.wings[0]!.broken = true;
    expect(wingCue(world)).toBeNull();
  });

  it('cueTime 0 turns the cue off', () => {
    const world = arena();
    world.tuning.wings.cueTime = 0;
    spawnWing(world, 3000, 0, Math.PI);
    expect(wingCue(world)).toBeNull();
  });
});
