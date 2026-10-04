import { describe, expect, it } from 'vitest';
import { createTuning } from '../../../data/tuning';
import { TRAIT_IDS, TRAITS, type TraitId } from '../../../data/content/traits';
import { spawnFighter } from '../ai/waves';
import { hashWorld } from '../replay/hash';
import { slotOf } from '../squadron/wingmen';
import type { Target } from '../world/target';
import { createWorld, stepWorld, type World } from '../world/world';
import { createEffectiveConfig, effectiveSquadronConfig, maxHpOf } from './effective';
import {
  activeCount,
  addPilot,
  findPilot,
  generateCandidates,
  generatePilots,
  losePilot,
  markBattleFlown,
} from './pilots';

const DT = 1 / 60;
const steps = (w: World, seconds: number): void => {
  for (let i = 0; i < Math.round(seconds / DT); i++) stepWorld(w, DT);
};

/** A quiet run-mode world (no waves, drones or turrets) whose squad is one wingman per given trait. */
function runWorld(traits: TraitId[], seed = 5): World {
  const tuning = createTuning();
  tuning.fighter.waveSize = 0;
  tuning.arena.staticCount = 0;
  tuning.arena.droneCount = 0;
  tuning.arena.turretCount = 0;
  const w = createWorld(seed, tuning);
  w.run.mode = 'run';
  traits.forEach((trait, i) => addPilot(w, { name: `Test P${i}`, trait }, 'pick'));
  stepWorld(w, DT); // the wingmen appear
  return w;
}

/** Shoots a wingman with an enemy bullet right on top of it. */
function shoot(w: World, wingmanIndex: number): void {
  const wm = w.squadron.wingmen[wingmanIndex]!;
  const k = w.enemyShots.spawn();
  w.enemyShots.data.x[k] = wm.ship.x;
  w.enemyShots.data.y[k] = wm.ship.y;
  w.enemyShots.data.vx[k] = 1;
  w.enemyShots.data.vy[k] = 0;
  w.enemyShots.data.life[k] = 2;
}

describe('pilot generation', () => {
  it('is deterministic per seed and differs between seeds', () => {
    const a = generatePilots(createWorld(7, createTuning()), 5);
    const b = generatePilots(createWorld(7, createTuning()), 5);
    expect(b).toEqual(a);
    expect(generatePilots(createWorld(8, createTuning()), 5)).not.toEqual(a);
  });

  it('never reuses a first name or a callsign inside a run, however many pilots are made', () => {
    const w = createWorld(3, createTuning());
    const names: string[] = [];
    for (let batch = 0; batch < 5; batch++) {
      for (const t of generatePilots(w, 4)) {
        names.push(t.name);
        w.pilots.roster.push({
          id: w.pilots.nextId++,
          name: t.name,
          trait: t.trait,
          kills: 0,
          battles: 0,
          status: 'lost', // lost pilots still reserve their names
          veteran: false,
        });
      }
    }
    expect(names).toHaveLength(20);
    expect(new Set(names.map((n) => n.split(' ')[0])).size).toBe(20);
    expect(new Set(names.map((n) => n.split(' ')[1])).size).toBe(20);
  });

  it('uses every trait, roughly evenly', () => {
    const counts: Record<string, number> = {};
    for (let seed = 1; seed <= 400; seed++) {
      const t = generatePilots(createWorld(seed, createTuning()), 1)[0]!;
      counts[t.trait] = (counts[t.trait] ?? 0) + 1;
    }
    for (const id of TRAIT_IDS) {
      expect(counts[id] ?? 0, id).toBeGreaterThan(400 * 0.1);
      expect(counts[id] ?? 0, id).toBeLessThan(400 * 0.3);
    }
  });

  it('a pick offers pickCount distinct pilots with different traits, none already in the squad', () => {
    const w = runWorld(['bold']);
    for (let n = 0; n < 20; n++) {
      const picks = generateCandidates(w);
      expect(picks).toHaveLength(w.tuning.pilots.pickCount);
      expect(new Set(picks.map((p) => p.name)).size).toBe(picks.length);
      expect(new Set(picks.map((p) => p.trait)).size).toBe(picks.length);
      expect(picks.some((p) => p.name === 'Test P0')).toBe(false);
    }
  });

  it('every call uses fresh draws (so repeated picks differ) and advances the counter', () => {
    const w = createWorld(2, createTuning());
    const first = generatePilots(w, 3);
    const draws = w.pilots.draws;
    expect(draws).toBeGreaterThan(0);
    expect(generatePilots(w, 3)).not.toEqual(first);
    expect(w.pilots.draws).toBeGreaterThan(draws);
  });

  it('generating changes the replay hash (the draw counter is state)', () => {
    const w = createWorld(2, createTuning());
    const before = hashWorld(w);
    generatePilots(w, 1);
    expect(hashWorld(w)).not.toBe(before);
  });
});

describe('the squad', () => {
  it('holds at most squadMax active pilots, announces joins, and frees a slot when a pilot is lost', () => {
    const w = createWorld(1, createTuning());
    for (let i = 0; i < w.tuning.pilots.squadMax; i++) {
      expect(addPilot(w, { name: `P${i}`, trait: 'steady' }, 'pick')).not.toBeNull();
    }
    expect(addPilot(w, { name: 'One too many', trait: 'steady' }, 'rescue')).toBeNull();
    expect(w.pilots.roster).toHaveLength(4);
    expect(w.events.events.filter((e) => e.type === 'PilotJoined')).toHaveLength(4);
    losePilot(w, 2);
    expect(activeCount(w.pilots)).toBe(3);
    expect(addPilot(w, { name: 'Replacement', trait: 'hunter' }, 'rescue')).not.toBeNull();
    expect(w.pilots.roster).toHaveLength(5); // the lost pilot stays on the list
  });

  it('gives ids from 1 up, never reused, and honours a saved veteran', () => {
    const w = createWorld(1, createTuning());
    const a = addPilot(w, { name: 'A', trait: 'bold' }, 'pick')!;
    const v = addPilot(w, { name: 'Vet', trait: 'hunter', kills: 9 }, 'veteran')!;
    expect([a.id, v.id]).toEqual([1, 2]);
    expect(a.veteran).toBe(false);
    expect([v.veteran, v.kills]).toEqual([true, 9]);
    expect(
      w.events.events
        .filter((e) => e.type === 'PilotJoined')
        .map((e) => (e as { how: string }).how),
    ).toEqual(['pick', 'veteran']);
  });

  it('losePilot announces once and ignores unknown or already lost pilots', () => {
    const w = createWorld(1, createTuning());
    addPilot(w, { name: 'A', trait: 'bold' }, 'pick');
    w.events.clear();
    losePilot(w, 1);
    losePilot(w, 1);
    losePilot(w, 99);
    expect(w.events.events.filter((e) => e.type === 'PilotLost')).toHaveLength(1);
    expect(findPilot(w.pilots, 1)!.status).toBe('lost');
  });

  it('markBattleFlown counts a battle for active pilots only', () => {
    const w = createWorld(1, createTuning());
    addPilot(w, { name: 'A', trait: 'bold' }, 'pick');
    addPilot(w, { name: 'B', trait: 'steady' }, 'pick');
    losePilot(w, 2);
    markBattleFlown(w);
    expect(w.pilots.roster.map((p) => p.battles)).toEqual([1, 0]);
  });
});

describe('trait effects (one effective config)', () => {
  const eff = createEffectiveConfig();
  const world = createWorld(1, createTuning());
  const base = world.tuning.squadron;
  const of = (trait: TraitId) => {
    // Straight into the roster: these tests only need the pilot to exist, not the squad cap.
    const id = world.pilots.nextId++;
    world.pilots.roster.push({
      id,
      name: `T-${trait}`,
      trait,
      kills: 0,
      battles: 0,
      status: 'active',
      veteran: false,
    });
    return effectiveSquadronConfig(eff, world, id);
  };

  it('Sharpshooter: wider fire cone and harder guns', () => {
    const c = of('sharpshooter');
    expect(c.fireCone).toBeCloseTo(base.fireCone * TRAITS.sharpshooter.multipliers.fireCone);
    expect(c.gunDamage).toBeCloseTo(base.gunDamage * TRAITS.sharpshooter.multipliers.gunDamage);
    expect(c.fireCone).toBeGreaterThan(base.fireCone);
    expect(c.gunDamage).toBeGreaterThan(base.gunDamage);
  });

  it('Steady: tighter slot hold and more hit points', () => {
    const c = of('steady');
    expect(c.slotHoldRadius).toBeLessThan(base.slotHoldRadius);
    expect(c.healthBonus).toBe(2);
  });

  it('Bold: longer engage range and more speed, fewer hit points', () => {
    const c = of('bold');
    expect(c.tightEngageRange).toBeCloseTo(base.tightEngageRange * 1.5);
    expect(c.spreadEngageRange).toBeCloseTo(base.spreadEngageRange * 1.5);
    expect(c.speedScale).toBeCloseTo(1.1);
    expect(c.healthBonus).toBe(-1);
  });

  it('Guardian: guards the player and engages from further out', () => {
    const c = of('guardian');
    expect(c.guardBias).toBe(1);
    expect(c.tightEngageRange).toBeCloseTo(base.tightEngageRange * 1.4);
  });

  it('Hunter: its missiles hit harder', () => {
    expect(of('hunter').missileDamage).toBeCloseTo(1.5);
  });

  it('a wingman with no pilot (practice mode) gets exactly the plain tuning', () => {
    const c = effectiveSquadronConfig(eff, world, 0);
    expect(c).toMatchObject({
      ...base,
      speedScale: 1,
      missileDamage: 1,
      guardBias: 0,
      healthBonus: 0,
    });
  });

  it('hit points follow the trait but never drop below 1', () => {
    const w = createWorld(1, createTuning());
    const steady = addPilot(w, { name: 'S', trait: 'steady' }, 'pick')!;
    const bold = addPilot(w, { name: 'B', trait: 'bold' }, 'pick')!;
    expect(maxHpOf(w, steady.id)).toBe(w.tuning.squadron.health + 2);
    expect(maxHpOf(w, bold.id)).toBe(w.tuning.squadron.health - 1);
    expect(maxHpOf(w, 0)).toBe(w.tuning.squadron.health);
    w.tuning.squadron.health = 1;
    expect(maxHpOf(w, bold.id)).toBe(1);
  });
});

describe('active pilots become the wingmen in run mode', () => {
  it('one wingman per active pilot, in roster order, with the trait hit points; wingmanCount is ignored', () => {
    const w = runWorld(['steady', 'bold', 'hunter']);
    expect(w.tuning.squadron.wingmanCount).toBe(2);
    expect(w.squadron.wingmen).toHaveLength(3);
    expect(w.squadron.wingmen.map((x) => x.pilotId)).toEqual([1, 2, 3]);
    expect(w.squadron.wingmen[0]!.hp).toBe(w.tuning.squadron.health + 2);
    expect(w.squadron.wingmen[1]!.hp).toBe(w.tuning.squadron.health - 1);
  });

  it('a pilot who joins later appears as a new wingman', () => {
    const w = runWorld(['steady']);
    addPilot(w, { name: 'Late', trait: 'hunter' }, 'rescue');
    stepWorld(w, DT);
    expect(w.squadron.wingmen.map((x) => x.pilotId)).toEqual([1, 2]);
  });

  it('practice mode ignores the roster and keeps wingmanCount anonymous wingmen', () => {
    const tuning = createTuning();
    tuning.fighter.waveSize = 0;
    const w = createWorld(5, tuning);
    addPilot(w, { name: 'Ignored', trait: 'bold' }, 'pick');
    stepWorld(w, DT);
    expect(w.squadron.wingmen).toHaveLength(2);
    expect(w.squadron.wingmen.every((x) => x.pilotId === 0)).toBe(true);
    expect(w.squadron.wingmen.every((x) => x.hp === tuning.squadron.health)).toBe(true);
  });

  it('formation slots are shared out among the living wingmen only', () => {
    const w = runWorld(['steady', 'bold', 'hunter']);
    w.squadron.wingmen[1]!.alive = false;
    expect(slotOf(w, 0, 3)).toEqual({ index: 0, count: 2 });
    expect(slotOf(w, 2, 3)).toEqual({ index: 1, count: 2 });
    w.run.mode = 'practice';
    expect(slotOf(w, 2, 3)).toEqual({ index: 2, count: 3 }); // practice mode: by list position, as before
  });
});

describe('losing a pilot', () => {
  it('in a run a downed wingman is a lost pilot for good: announced once, never respawns', () => {
    const w = runWorld(['steady', 'bold']);
    w.squadron.wingmen[1]!.hp = 1;
    w.events.clear();
    shoot(w, 1);
    stepWorld(w, DT);
    expect(w.events.events.filter((e) => e.type === 'PilotLost')).toEqual([
      { type: 'PilotLost', pilotId: 2 },
    ]);
    expect(findPilot(w.pilots, 2)!.status).toBe('lost');
    expect(w.squadron.wingmen[1]!.alive).toBe(false);
    steps(w, w.tuning.squadron.respawnDelay + 10); // far longer than a practice-mode respawn
    expect(w.squadron.wingmen[1]!.alive).toBe(false);
    expect(w.squadron.wingmen).toHaveLength(2); // the dead entry stays, so salvo indices never shift
    expect(findPilot(w.pilots, 1)!.status).toBe('active');
  });

  it('in practice mode the same wingman respawns after the delay and no pilot is involved', () => {
    const tuning = createTuning();
    tuning.fighter.waveSize = 0;
    tuning.arena.staticCount = 0;
    tuning.arena.droneCount = 0;
    tuning.arena.turretCount = 0;
    const w = createWorld(5, tuning);
    stepWorld(w, DT);
    w.squadron.wingmen[1]!.hp = 1;
    shoot(w, 1);
    stepWorld(w, DT);
    expect(w.squadron.wingmen[1]!.alive).toBe(false);
    steps(w, tuning.squadron.respawnDelay + 1);
    expect(w.squadron.wingmen[1]!.alive).toBe(true);
    expect(w.events.events.some((e) => e.type === 'PilotLost')).toBe(false);
    expect(w.pilots.roster).toHaveLength(0);
  });
});

describe('what traits change in play', () => {
  it('a Sharpshooter fires harder bullets, tagged with its pilot id', () => {
    const w = runWorld(['sharpshooter']);
    w.tuning.arena.enemiesFrozen = true; // the enemy stands still and does nothing
    spawnFighter(w, w.ship.x + 450, w.ship.y, Math.PI);
    w.fighters[0]!.hp = 1e6;
    let found = false;
    for (let i = 0; i < 60 * 6 && !found; i++) {
      stepWorld(w, DT);
      for (let k = 0; k < w.bullets.count; k++) {
        if (w.bullets.data.owner[k] === 1) {
          found = true;
          expect(w.bullets.data.damage[k]).toBeCloseTo(
            w.tuning.squadron.gunDamage * TRAITS.sharpshooter.multipliers.gunDamage,
          );
        }
      }
    }
    expect(found).toBe(true);
  });

  it('a Guardian goes for the enemy chasing the player, a neutral pilot for the nearest one', () => {
    const w = runWorld(['sharpshooter', 'guardian']);
    w.tuning.arena.enemiesFrozen = true;
    const near = spawnFighter(w, w.ship.x + 400, w.ship.y, Math.PI); // chasing a wingman
    const chaser = spawnFighter(w, w.ship.x + 500, w.ship.y, Math.PI); // chasing the player
    w.fighters[near]!.targetIndex = 0;
    w.fighters[chaser]!.targetIndex = -1;
    w.fighters[near]!.hp = w.fighters[chaser]!.hp = 1e6;
    stepWorld(w, DT);
    const [neutral, guardian] = w.squadron.wingmen;
    expect(neutral!.engagedId).toBe(1000 + near);
    expect(guardian!.engagedId).toBe(1000 + chaser);
  });

  it('wingman missiles carry their pilot and damage scale: a Hunter hits x1.5, the player x1', () => {
    const w = runWorld(['hunter']);
    w.tuning.arena.enemiesFrozen = true;
    w.targets.push(target(w.ship.x + 500, w.ship.y));
    w.lockon.locks.push(w.targets.length - 1);
    w.actions.launch = true;
    stepWorld(w, DT);
    w.actions.launch = false;
    const scaleByOwner = new Map<number, number>();
    for (let i = 0; i < 30; i++) {
      stepWorld(w, DT);
      for (let k = 0; k < w.missiles.count; k++) {
        scaleByOwner.set(w.missiles.data.owner[k]!, w.missiles.data.damageScale[k]!);
      }
    }
    expect(scaleByOwner.get(0)).toBe(1); // the player's missile
    expect(scaleByOwner.get(1)).toBeCloseTo(TRAITS.hunter.multipliers.missileDamage); // the Hunter's
  });
});

describe('kill credit', () => {
  /** A quiet run world with one pilot and a far-away enemy fighter to shoot at. */
  function setup() {
    const w = runWorld(['bold']);
    w.tuning.arena.enemiesFrozen = true;
    const i = spawnFighter(w, w.ship.x + 3000, w.ship.y, Math.PI);
    return { w, fighter: w.fighters[i]!, id: 1000 + i };
  }

  /** A bullet fired by `owner` that lands on the fighter this step and kills it. */
  function killShot(w: World, x: number, y: number, owner: number): void {
    const k = w.bullets.spawn();
    w.bullets.data.x[k] = x;
    w.bullets.data.y[k] = y;
    w.bullets.data.life[k] = 1;
    w.bullets.data.damage[k] = 100;
    w.bullets.data.owner[k] = owner;
  }

  it("a pilot's bullet that kills an enemy gives that pilot the kill and a PilotKill event", () => {
    const { w, fighter } = setup();
    killShot(w, fighter.x, fighter.y, 1);
    w.events.clear();
    stepWorld(w, DT);
    expect(fighter.alive).toBe(false);
    expect(findPilot(w.pilots, 1)!.kills).toBe(1);
    expect(w.events.events.filter((e) => e.type === 'PilotKill')).toEqual([
      { type: 'PilotKill', pilotId: 1 },
    ]);
  });

  it("the player's own kills credit nobody", () => {
    const { w, fighter } = setup();
    killShot(w, fighter.x, fighter.y, 0);
    stepWorld(w, DT);
    expect(fighter.alive).toBe(false);
    expect(findPilot(w.pilots, 1)!.kills).toBe(0);
    expect(w.events.events.some((e) => e.type === 'PilotKill')).toBe(false);
  });

  it('the pilot who lands the last damage gets it, even if the player hit first', () => {
    const { w, fighter } = setup();
    fighter.hp = 150;
    killShot(w, fighter.x, fighter.y, 0); // the player's shot does 100 and leaves it alive
    stepWorld(w, DT);
    expect(fighter.alive).toBe(true);
    expect(fighter.lastHitBy).toBe(0);
    killShot(w, fighter.x, fighter.y, 1);
    stepWorld(w, DT);
    expect(fighter.alive).toBe(false);
    expect(findPilot(w.pilots, 1)!.kills).toBe(1);
  });

  it('a kill is counted once', () => {
    const { w, fighter } = setup();
    killShot(w, fighter.x, fighter.y, 1);
    stepWorld(w, DT);
    steps(w, 1);
    expect(findPilot(w.pilots, 1)!.kills).toBe(1);
  });
});

function target(x: number, y: number): Target {
  return {
    kind: 'drone',
    mode: 'static',
    x,
    y,
    radius: 30,
    hp: 50,
    maxHp: 50,
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
    lastHitBy: 0,
  };
}
