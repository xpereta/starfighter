import { describe, expect, it } from 'vitest';
import { createTuning } from '../../../data/tuning';
import { spawnFighter } from '../ai/waves';
import { hashWorld } from '../replay/hash';
import { runReplay, startRecording } from '../replay/replay';
import { createWorld, stepWorld, type World } from './world';

const DT = 1 / 60;
const steps = (w: World, seconds: number): void => {
  for (let i = 0; i < Math.round(seconds / DT); i++) stepWorld(w, DT);
};
const positions = (w: World): number[] => [
  ...w.targets.flatMap((t) => [t.x, t.y]),
  ...w.fighters.flatMap((f) => [f.x, f.y]),
];

function arena(frozen: boolean): World {
  const tuning = createTuning();
  tuning.arena.enemiesFrozen = frozen;
  tuning.squadron.wingmanCount = 0;
  return createWorld(3, tuning);
}

describe('debug: freeze enemies', () => {
  it('is off by default', () => {
    expect(createTuning().arena.enemiesFrozen).toBe(false);
  });

  it('drones, turrets and fighters stay exactly where they are, with no shots, waves or hits', () => {
    const w = arena(true);
    spawnFighter(w, 700, 0, Math.PI);
    spawnFighter(w, -600, 300, 0);
    const before = positions(w);
    w.ship.x = 650; // parked right in front of a fighter and inside turret range, just to tempt them
    steps(w, 20);
    expect(positions(w)).toEqual(before);
    expect(w.fighters).toHaveLength(2); // no new wave
    expect(w.enemyShots.count).toBe(0);
    expect(w.stats.hitsTaken).toBe(0);
    for (const t of w.targets) expect([t.vx, t.vy]).toEqual([0, 0]);
  });

  it('the same arena unfrozen does move, fire and bring waves', () => {
    const w = arena(false);
    const before = positions(w);
    steps(w, 20);
    expect(w.fighters.length).toBeGreaterThan(0); // a wave arrived
    expect(positions(w).slice(0, before.length)).not.toEqual(before); // drones moved
  });

  it('shots in the air disappear when the freeze is switched on, and play resumes when it is off', () => {
    const w = arena(false);
    w.enemyShots.spawn();
    w.enemyShots.data.life[0] = 5;
    w.tuning.arena.enemiesFrozen = true;
    stepWorld(w, DT);
    expect(w.enemyShots.count).toBe(0);
    const before = positions(w);
    steps(w, 2);
    expect(positions(w)).toEqual(before);
    w.tuning.arena.enemiesFrozen = false;
    steps(w, 5);
    expect(positions(w)).not.toEqual(before);
  });

  it('frozen enemies can still be shot down', () => {
    const w = arena(true);
    for (const t of w.targets) t.alive = false; // keep the lane clear of other targets
    const i = spawnFighter(w, 400, 0, Math.PI);
    w.ship.heading = 0;
    w.actions.fire = true;
    steps(w, 4);
    expect(w.fighters[i]!.alive).toBe(false);
    expect(w.fighters[i]!.x).toBe(400); // it never moved
  });

  it('a frozen run is reproduced exactly by its replay', () => {
    const w = arena(true);
    const recorder = startRecording(w);
    w.actions.throttle = 1;
    w.actions.steerX = 0.5;
    for (let i = 0; i < 600; i++) {
      recorder.record(w.tick, w.actions);
      stepWorld(w, DT);
    }
    const replay = recorder.finish(w);
    expect(replay.tuning.arena.enemiesFrozen).toBe(true);
    expect(hashWorld(runReplay(replay))).toBe(replay.finalHash);
  });
});
