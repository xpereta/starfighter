import { describe, expect, it } from 'vitest';
import { createTuning, type Tuning } from '../../../data/tuning';
import { chooseTarget, podTargetIndex, targetOf } from '../ai/fighters';
import { spawnFighter } from '../ai/waves';
import { hashWorld } from '../replay/hash';
import { nearestPod, podBattle, squadFull } from './pods';
import { createWorld, stepWorld, type World } from './world';

const DT = 1 / 60;
const steps = (w: World, seconds: number): void => {
  for (let i = 0; i < Math.round(seconds / DT); i++) stepWorld(w, DT);
};
const eventsOf = (w: World, type: string): number =>
  w.events.events.filter((e) => e.type === type).length;

/** A run-mode world in battle 2, wave 2, with no other enemies, so only pods are in play. */
function runWorld(tweak?: (t: Tuning) => void): World {
  const tuning = createTuning();
  tuning.fighter.waveSize = 0;
  tuning.arena.staticCount = 0;
  tuning.arena.droneCount = 0;
  tuning.arena.turretCount = 0;
  tuning.squadron.wingmanCount = 0;
  tweak?.(tuning);
  // Hold the wave open so the real run logic leaves it alone: one dead fighter and a huge wave delay
  // mean wave 3 never starts and the battle is never cleared.
  tuning.fighter.waveDelay = 1e6;
  const w = createWorld(5, tuning);
  w.run.mode = 'run';
  w.run.phase = 'battle';
  w.run.battle = 2;
  w.run.wave = 2;
  w.run.waveTotal = 3;
  w.run.waveStartTick = 0; // wave 2 "starts" at the first step
  w.run.hull = tuning.run.playerHull;
  const placeholder = spawnFighter(w, 5000, 0, 0);
  w.fighters[placeholder]!.alive = false;
  w.fighters[placeholder]!.diedAt = w.time;
  return w;
}

const activePilot = (id: number) => ({
  id,
  name: `P${id}`,
  trait: 'bold' as const,
  kills: 0,
  battles: 0,
  status: 'active' as const,
  veteran: false,
});

/** Steps once with the player parked on the first pod (the step first, so the rescue sees it close). */
function holdAtPod(w: World, seconds: number): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    const pod = w.pods[0];
    if (pod) {
      w.ship.x = pod.x;
      w.ship.y = pod.y;
    }
    stepWorld(w, DT);
  }
}

describe('when a pod appears', () => {
  it('one pod in battle 2 at wave 2, far out, with its pilot id reserved, announced by PodSpawned', () => {
    const w = runWorld();
    const nextId = w.pilots.nextId;
    stepWorld(w, DT);
    expect(w.pods).toHaveLength(1);
    const pod = w.pods[0]!;
    expect(pod.alive).toBe(true);
    expect(pod.hp).toBe(w.tuning.rescue.podHealth);
    expect(Math.hypot(pod.x, pod.y)).toBeCloseTo(
      w.tuning.flight.arenaRadius * w.tuning.rescue.podSpawnFraction,
      0,
    );
    expect(pod.pilotId).toBe(0); // the pilot is only generated when the pod is rescued
    expect(w.pilots.nextId).toBe(nextId);
    expect(eventsOf(w, 'PodSpawned')).toBe(1);
  });

  it('only one pod per battle, even after it is gone', () => {
    const w = runWorld();
    steps(w, 1);
    w.pods[0]!.alive = false; // destroyed
    steps(w, 5);
    expect(w.pods).toHaveLength(1);
  });

  it('never in practice mode, in battles outside the range, before its wave, or with a full squad', () => {
    const practice = runWorld();
    practice.run.mode = 'practice';
    practice.run.battle = 0;
    steps(practice, 2);
    expect(practice.pods).toHaveLength(0);

    for (const battle of [1, 4]) {
      const w = runWorld();
      w.run.battle = battle;
      steps(w, 2);
      expect(w.pods).toHaveLength(0);
    }

    const early = runWorld();
    early.run.wave = 1;
    steps(early, 2);
    expect(early.pods).toHaveLength(0);

    const full = runWorld();
    for (let i = 1; i <= 4; i++) full.pilots.roster.push(activePilot(i));
    expect(squadFull(full)).toBe(true);
    steps(full, 2);
    expect(full.pods).toHaveLength(0);
  });

  it('lost pilots do not count against the squad limit, and the battle range is configurable', () => {
    const w = runWorld();
    for (let i = 1; i <= 4; i++)
      w.pilots.roster.push({ ...activePilot(i), status: i === 4 ? 'lost' : 'active' });
    expect(squadFull(w)).toBe(false);
    expect(podBattle(w, 2)).toBe(true);
    expect(podBattle(w, 1)).toBe(false);
    w.tuning.rescue.podFirstBattle = 1;
    expect(podBattle(w, 1)).toBe(true);
  });

  it('a new battle drops the old pod and brings a new one', () => {
    const w = runWorld();
    steps(w, 1);
    const first = w.pods[0]!;
    w.run.battle = 3;
    w.run.waveStartTick = w.tick; // wave 2 of battle 3 starts now
    steps(w, 1);
    expect(w.pods).toHaveLength(1);
    expect(w.pods[0]).not.toBe(first);
    expect(w.pods[0]!.battle).toBe(3);
  });
});

describe('a pod only appears when its wave starts', () => {
  it('not on a later step of the wave, even with a free slot', () => {
    const w = runWorld();
    w.run.waveStartTick = -10; // the wave started long ago
    steps(w, 3);
    expect(w.pods).toHaveLength(0);
  });

  it('a full squad at the wave start means no pod that battle, even if a slot frees later', () => {
    const w = runWorld();
    for (let i = 1; i <= 4; i++) w.pilots.roster.push(activePilot(i));
    steps(w, 1);
    expect(w.pods).toHaveLength(0);
    w.pilots.roster[0]!.status = 'lost'; // a pilot is lost: a slot is free now
    steps(w, 3);
    expect(w.pods).toHaveLength(0);
  });

  it('a pilot rescued from a pod is generated by the pilots module (never repeats a name)', () => {
    const w = runWorld();
    steps(w, 0.1);
    holdAtPod(w, w.tuning.rescue.rescueTime + 0.5);
    const pilot = w.pilots.roster.at(-1)!;
    expect(pilot.id).toBe(w.pods[0]!.pilotId);
    const names = w.pilots.roster.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('drift', () => {
  it('moves at the drift speed, turns back near the arena edge, and stays put at speed 0', () => {
    const w = runWorld();
    steps(w, 0.1);
    const pod = w.pods[0]!;
    const before = { x: pod.x, y: pod.y };
    steps(w, 1);
    expect(Math.hypot(pod.x - before.x, pod.y - before.y)).toBeCloseTo(
      w.tuning.rescue.podDriftSpeed,
      0,
    );
    // Near the edge it turns back toward the middle.
    const arena = w.tuning.flight.arenaRadius;
    pod.x = arena * 0.99;
    pod.y = 0;
    pod.vx = w.tuning.rescue.podDriftSpeed;
    pod.vy = 0;
    steps(w, 1);
    expect(pod.vx).toBeLessThan(0);
    expect(Math.hypot(pod.x, pod.y)).toBeLessThan(arena);

    const still = runWorld((t) => (t.rescue.podDriftSpeed = 0));
    steps(still, 0.1);
    const p0 = { x: still.pods[0]!.x, y: still.pods[0]!.y };
    steps(still, 3);
    expect([still.pods[0]!.x, still.pods[0]!.y]).toEqual([p0.x, p0.y]);
  });

  it('is paused while a menu is up in run mode', () => {
    const w = runWorld();
    steps(w, 0.1);
    w.run.phase = 'debrief';
    const x = w.pods[0]!.x;
    steps(w, 2);
    expect(w.pods[0]!.x).toBe(x);
  });
});

describe('rescue', () => {
  it('fills while you stay close; after rescueTime a generated pilot joins at once', () => {
    const w = runWorld();
    steps(w, 0.1);
    holdAtPod(w, w.tuning.rescue.rescueTime / 2);
    expect(w.pods[0]!.progress).toBeGreaterThan(0.4);
    expect(w.pods[0]!.progress).toBeLessThan(0.6);
    holdAtPod(w, w.tuning.rescue.rescueTime / 2 + 0.2);
    const pod = w.pods[0]!;
    expect(pod.rescued).toBe(true);
    expect(pod.alive).toBe(false);
    const pilot = w.pilots.roster.find((p) => p.id === pod.pilotId);
    expect(pilot).toBeDefined();
    expect(pilot!.status).toBe('active');
    expect(pilot!.name.length).toBeGreaterThan(3);
  });

  it('announces the rescue with PodRescued and PilotJoined{how: rescue}', () => {
    const w = runWorld();
    steps(w, 0.1);
    const seen = new Set<string>();
    let pilotId = -1;
    for (let i = 0; i < 60 * 4; i++) {
      holdAtPod(w, DT);
      for (const e of w.events.events) {
        if (e.type === 'PodRescued') {
          seen.add('PodRescued');
          pilotId = e.pilotId;
        }
        if (e.type === 'PilotJoined') {
          seen.add(`PilotJoined:${e.how}`);
          expect(e.pilotId).toBe(pilotId === -1 ? e.pilotId : pilotId);
        }
      }
    }
    expect([...seen].sort()).toEqual(['PilotJoined:rescue', 'PodRescued']);
  });

  it('drains while you are away (and not at all with rescueDrain 0)', () => {
    const w = runWorld();
    steps(w, 0.1);
    holdAtPod(w, 1);
    const filled = w.pods[0]!.progress;
    expect(filled).toBeGreaterThan(0.3);
    w.ship.x = 0;
    w.ship.y = 0;
    w.ship.vx = 0;
    w.ship.vy = 0;
    w.actions.throttle = -1;
    steps(w, 1);
    expect(w.pods[0]!.progress).toBeLessThan(filled);
    expect(w.pods[0]!.progress).toBeGreaterThan(0);

    const keep = runWorld((t) => (t.rescue.rescueDrain = 0));
    steps(keep, 0.1);
    holdAtPod(keep, 1);
    const kept = keep.pods[0]!.progress;
    keep.ship.x = 0;
    keep.ship.y = 0;
    steps(keep, 2);
    expect(keep.pods[0]!.progress).toBeCloseTo(kept, 5);
  });

  it('holds at full while the squad is full, and completes when a slot frees up', () => {
    const w = runWorld();
    steps(w, 0.1);
    for (let i = 10; i < 14; i++) w.pilots.roster.push(activePilot(i));
    holdAtPod(w, w.tuning.rescue.rescueTime + 1);
    expect(w.pods[0]!.alive).toBe(true);
    expect(w.pods[0]!.progress).toBe(1);
    w.pilots.roster[0]!.status = 'lost';
    holdAtPod(w, 0.2);
    expect(w.pods[0]!.rescued).toBe(true);
  });
});

describe('destruction', () => {
  function shootPod(w: World, count: number): void {
    const pod = w.pods[0]!;
    for (let i = 0; i < count; i++) {
      const k = w.enemyShots.spawn();
      w.enemyShots.data.x[k] = pod.x;
      w.enemyShots.data.y[k] = pod.y;
      w.enemyShots.data.life[k] = 5;
    }
  }

  it('enemy bullets that hit it take hit points, and at zero the pod and its pilot are lost', () => {
    const w = runWorld();
    steps(w, 0.1);
    const hp = w.pods[0]!.hp;
    shootPod(w, 1);
    stepWorld(w, DT);
    expect(w.pods[0]!.hp).toBe(hp - 1);
    expect(w.enemyShots.count).toBe(0); // the bullet is used up
    const pilots = w.pilots.roster.length;
    shootPod(w, hp);
    stepWorld(w, DT);
    expect(w.pods[0]!.alive).toBe(false);
    expect(w.pods[0]!.rescued).toBe(false);
    expect(eventsOf(w, 'PodLost')).toBe(1);
    expect(w.pilots.roster).toHaveLength(pilots); // no pilot joins
  });

  it('bullets far from the pod do nothing', () => {
    const w = runWorld();
    steps(w, 0.1);
    const k = w.enemyShots.spawn();
    w.enemyShots.data.x[k] = w.pods[0]!.x + 2000;
    w.enemyShots.data.y[k] = w.pods[0]!.y;
    w.enemyShots.data.life[k] = 5;
    const hp = w.pods[0]!.hp;
    stepWorld(w, DT);
    expect(w.pods[0]!.hp).toBe(hp);
  });
});

describe('enemies target pods', () => {
  it('a fighter picks a pod within the threat range when it is nearer than the player and wingmen', () => {
    const w = runWorld();
    steps(w, 0.1);
    const pod = w.pods[0]!;
    w.ship.x = pod.x + 3000; // the player is far away
    w.ship.y = pod.y;
    const near = chooseTarget(w, pod.x + 500, pod.y);
    expect(near).toBe(podTargetIndex(0));
    expect(targetOf(w, near)).toBe(pod);
    // Beyond the threat range it ignores the pod and goes for the player.
    expect(chooseTarget(w, pod.x - w.tuning.rescue.podThreatRange - 500, pod.y - 1)).toBe(-1);
  });

  it('a destroyed pod is no longer a target', () => {
    const w = runWorld();
    steps(w, 0.1);
    w.pods[0]!.alive = false;
    expect(targetOf(w, podTargetIndex(0))).toBeNull();
    expect(chooseTarget(w, w.pods[0]!.x + 100, w.pods[0]!.y)).toBe(-1);
    expect(nearestPod(w, w.pods[0]!.x, w.pods[0]!.y, 5000)).toBe(-1);
  });

  it('a turret shoots at a pod in range, even when the player is far, and prefers it to the player', () => {
    const w = runWorld((t) => (t.arena.turretCount = 1));
    steps(w, 0.1);
    const pod = w.pods[0]!;
    const turret = w.targets.find((t) => t.kind === 'turret')!;
    // Put the pod close to the turret, the player far from it.
    pod.x = turret.x + 600;
    pod.y = turret.y;
    pod.vx = 0;
    pod.vy = 0;
    w.ship.x = turret.x + 9000;
    w.ship.y = turret.y;
    turret.cooldown = 0;
    stepWorld(w, DT);
    expect(w.enemyShots.count).toBe(1);
    expect(w.enemyShots.data.vx[0]!).toBeGreaterThan(0); // aimed at the pod (to the right of the turret)
    // With the player in range as well, it still shoots the pod.
    w.enemyShots.clear();
    w.ship.x = turret.x - 500;
    w.ship.y = turret.y;
    turret.cooldown = 0;
    stepWorld(w, DT);
    expect(w.enemyShots.data.vx[0]!).toBeGreaterThan(0);
  });

  it('a turret ignores a pod outside the threat range and shoots the player as before', () => {
    const w = runWorld((t) => (t.arena.turretCount = 1));
    steps(w, 0.1);
    const pod = w.pods[0]!;
    const turret = w.targets.find((t) => t.kind === 'turret')!;
    pod.x = turret.x + w.tuning.rescue.podThreatRange + 800;
    pod.y = turret.y;
    pod.vx = 0;
    pod.vy = 0;
    w.ship.x = turret.x - 500;
    w.ship.y = turret.y;
    turret.cooldown = 0;
    stepWorld(w, DT);
    expect(w.enemyShots.count).toBe(1);
    expect(w.enemyShots.data.vx[0]!).toBeLessThan(0); // toward the player on its left
  });
});

describe('determinism', () => {
  it('the same seed and the same flying give the same pods and the same hash', () => {
    const play = (): World => {
      const w = runWorld();
      for (let i = 0; i < 60 * 12; i++) {
        w.actions.steerX = Math.cos(i / 40);
        w.actions.steerY = Math.sin(i / 40);
        stepWorld(w, DT);
      }
      return w;
    };
    const a = play();
    const b = play();
    expect(a.pods).toEqual(b.pods);
    expect(hashWorld(a)).toBe(hashWorld(b));
  });
});
