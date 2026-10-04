import { describe, expect, it } from 'vitest';
import { createTuning } from '../../../data/tuning';
import { spawnFighter } from '../ai/waves';
import { createWorld, stepWorld, type World } from '../world/world';
import { hashWorld } from './hash';

/**
 * Audit: every field of every gameplay state object must change the replay hash when it changes.
 * New state that is not in `hashWorld` fails here by name. Fields that are deliberately not state
 * are listed in EXEMPT with the reason.
 */
const EXEMPT: Record<string, string> = {
  'world.actions': 'inputs, applied from the replay each step; not carried state',
  'world.events': 'cleared every step',
  'world.tuning': 'snapshotted in the replay itself',
  'world.camera': 'depends on the window shape, not gameplay (see hash.ts)',
  'ship.outside': 'recomputed from the position at the start of every flight step',
  'wingman.ship.outside': 'recomputed from the position at the start of every flight step',
  'fighter.ship.outside': 'recomputed from the position at the start of every flight step',
  'fighter.actions': 'recomputed by the AI before every flight step',
  'wingman.actions': 'recomputed by the AI before every flight step',
};

/** A world in the middle of a busy dogfight: fighters, wingmen, locks, a salvo and missiles in flight. */
function busyWorld(): World {
  const tuning = createTuning();
  const w = createWorld(11, tuning);
  const dt = 1 / 60;
  stepWorld(w, dt); // creates the wingmen
  spawnFighter(w, 900, 200, Math.PI);
  spawnFighter(w, -700, -300, 0);
  for (let i = 0; i < 40; i++) {
    w.actions.fire = i % 2 === 0;
    stepWorld(w, dt);
  }
  // Two targets close in front of the ship, so the locks survive the range check and the salvo launches.
  w.targets[0]!.x = w.ship.x + 500;
  w.targets[0]!.y = w.ship.y;
  w.targets[1]!.x = w.ship.x + 600;
  w.targets[1]!.y = w.ship.y + 80;
  w.lockon.locks.push(0, 1);
  w.lockon.graces.push(0, 0.1);
  w.lockon.acquiringId = 2;
  w.lockon.progress = 0.4;
  w.actions.launch = true;
  stepWorld(w, dt);
  w.actions.launch = false;
  for (let i = 0; i < 12; i++) stepWorld(w, dt);
  w.enemyShots.spawn();
  w.bullets.spawn();
  w.pilots.roster.push({
    id: 1,
    name: 'Mara Ember',
    trait: 'bold',
    kills: 2,
    battles: 1,
    status: 'active',
    veteran: false,
  });
  w.pods.push({ x: 100, y: 200, vx: 1, vy: 0, hp: 3, alive: true, progress: 0.2, pilotId: 2 });
  w.run.battle = 2;
  w.run.wave = 1;
  w.squadron.cue = 'no-target';
  w.squadron.cueTimer = 0.5;
  return w;
}

/** Changes one value and says how to put it back, or null when it cannot be perturbed. */
function perturb(obj: Record<string, unknown>, key: string): (() => void) | null {
  const old = obj[key];
  if (typeof old === 'number') obj[key] = old + 0.37;
  else if (typeof old === 'boolean') obj[key] = !old;
  else if (key === 'formation') obj[key] = old === 'tight' ? 'spread' : 'tight';
  else if (key === 'order') obj[key] = old === 'none' ? 'attack' : 'none';
  else if (key === 'cue') obj[key] = old === 'none' ? 'no-target' : 'none';
  else if (key === 'mode') {
    // The run's mode (practice/run) or a target's movement mode (static/straight/circle).
    obj[key] =
      old === 'practice'
        ? 'run'
        : old === 'run'
          ? 'practice'
          : old === 'static'
            ? 'circle'
            : 'static';
  } else if (key === 'kind') obj[key] = old === 'drone' ? 'turret' : 'drone';
  else if (key === 'phase') obj[key] = old === 'battle' ? 'debrief' : 'battle';
  else if (key === 'result') obj[key] = old === 'none' ? 'victory' : 'none';
  else if (key === 'trait') obj[key] = old === 'bold' ? 'steady' : 'bold';
  else if (key === 'status') obj[key] = old === 'active' ? 'lost' : 'active';
  else if (key === 'name') obj[key] = `${String(old)}x`;
  else return null;
  return () => {
    obj[key] = old;
  };
}

function missing(world: World, label: string, obj: Record<string, unknown>): string[] {
  const base = hashWorld(world);
  const out: string[] = [];
  for (const key of Object.keys(obj)) {
    const path = `${label}.${key}`;
    if (EXEMPT[path]) continue;
    const undo = perturb(obj, key);
    if (!undo) continue;
    if (hashWorld(world) === base) out.push(path);
    undo();
  }
  return out;
}

describe('every gameplay field is in the replay hash', () => {
  it('the busy world really has fighters, wingmen, a salvo and missiles in flight', () => {
    const w = busyWorld();
    expect(w.fighters.length).toBeGreaterThanOrEqual(2);
    expect(w.squadron.wingmen.length).toBeGreaterThan(0);
    expect(w.missiles.count + w.missiles.salvo.pending.length).toBeGreaterThan(0);
  });

  it('plain state objects', () => {
    const w = busyWorld();
    const gaps = [
      ...missing(w, 'ship', w.ship as unknown as Record<string, unknown>),
      ...missing(w, 'guns', w.guns as unknown as Record<string, unknown>),
      ...missing(w, 'lockon', w.lockon as unknown as Record<string, unknown>),
      ...missing(w, 'squadron', w.squadron as unknown as Record<string, unknown>),
      ...missing(w, 'trial', w.trial as unknown as Record<string, unknown>),
      ...missing(w, 'stats', w.stats as unknown as Record<string, unknown>),
      ...missing(w, 'prev', w.prev as unknown as Record<string, unknown>),
      ...missing(w, 'run', w.run as unknown as Record<string, unknown>),
      ...missing(w, 'pilots', w.pilots as unknown as Record<string, unknown>),
      ...missing(w, 'pilot', w.pilots.roster[0] as unknown as Record<string, unknown>),
      ...missing(w, 'pod', w.pods[0] as unknown as Record<string, unknown>),
      ...missing(w, 'salvo', w.missiles.salvo as unknown as Record<string, unknown>),
      ...missing(w, 'target', w.targets[0] as unknown as Record<string, unknown>),
      ...missing(w, 'wingman', w.squadron.wingmen[0] as unknown as Record<string, unknown>),
      ...missing(
        w,
        'wingman.ship',
        w.squadron.wingmen[0]!.ship as unknown as Record<string, unknown>,
      ),
      ...missing(w, 'fighter', w.fighters[0] as unknown as Record<string, unknown>),
      ...missing(w, 'fighter.ship', w.fighters[0]!.ship as unknown as Record<string, unknown>),
    ];
    expect(gaps).toEqual([]);
  });

  it('every field of every pool (bullets, enemy shots, missiles)', () => {
    const w = busyWorld();
    const gaps: string[] = [];
    for (const [name, pool] of [
      ['bullets', w.bullets],
      ['enemyShots', w.enemyShots],
      ['missiles', w.missiles],
    ] as const) {
      expect(pool.count, `${name} has an item`).toBeGreaterThan(0);
      const base = hashWorld(w);
      for (const field of Object.keys(pool.data)) {
        const arr = (pool.data as unknown as Record<string, Float32Array>)[field]!;
        const old = arr[0]!;
        arr[0] = old + 0.5;
        if (hashWorld(w) === base) gaps.push(`${name}.${field}`);
        arr[0] = old;
      }
    }
    expect(gaps).toEqual([]);
  });

  it('the random number generator state, lock arrays and the target list', () => {
    const w = busyWorld();
    const a = hashWorld(w);
    w.rng.next(); // consuming randomness changes the future, so it must change the hash
    expect(hashWorld(w)).not.toBe(a);
    const b = hashWorld(w);
    w.lockon.graces[0] = (w.lockon.graces[0] ?? 0) + 0.3;
    expect(hashWorld(w)).not.toBe(b);
    const c = hashWorld(w);
    w.missiles.salvo.pending.push(3);
    expect(hashWorld(w)).not.toBe(c);
  });
});
