import { describe, expect, it } from 'vitest';
import { createTuning } from '../../../data/tuning';
import { spawnFighter } from '../ai/waves';
import { enterStartScreen, offerVeterans } from '../run/run';
import { createRng } from '../rng/rng';
import { createActions } from '../world/actions';
import { createWorld, stepWorld, type World } from '../world/world';
import { hashWorld } from './hash';
import {
  createPlayer,
  parseReplay,
  restartWorld,
  runReplay,
  serializeReplay,
  startRecording,
  type Replay,
} from './replay';

const DT = 1 / 60;

/** Plays `seconds` of seeded random inputs on a live world while recording. */
function recordRandomRun(
  seed: number,
  inputSeed: number,
  seconds: number,
): { world: World; replay: Replay } {
  const world = createWorld(seed, createTuning());
  const recorder = startRecording(world);
  const rng = createRng(inputSeed);
  const a = world.actions;
  for (let i = 0; i < seconds * 60; i++) {
    if (i % 20 === 0) {
      a.steerX = rng.range(-1, 1);
      a.steerY = rng.range(-1, 1);
      a.rotate = rng.int(3) - 1;
      a.throttle = rng.range(-1, 1);
      a.fire = rng.next() < 0.7;
      a.evade = rng.next() < 0.15;
      a.startTrial = rng.next() < 0.02;
      a.respawn = rng.next() < 0.01;
    }
    recorder.record(world.tick, a);
    stepWorld(world, DT);
  }
  return { world, replay: recorder.finish(world) };
}

describe('determinism', () => {
  it('same seed + same inputs give an identical final state', () => {
    const a = recordRandomRun(42, 7, 30);
    const b = recordRandomRun(42, 7, 30);
    expect(hashWorld(a.world)).toBe(hashWorld(b.world));
    expect(a.replay).toEqual(b.replay);
  });

  it('a different seed or different inputs give a different state', () => {
    const base = hashWorld(recordRandomRun(42, 7, 30).world);
    expect(hashWorld(recordRandomRun(43, 7, 30).world)).not.toBe(base);
    expect(hashWorld(recordRandomRun(42, 8, 30).world)).not.toBe(base);
  });

  it('replaying a recording reproduces the live run exactly', () => {
    const { world, replay } = recordRandomRun(5, 11, 45);
    expect(replay.finalHash).toBe(hashWorld(world));
    const rerun = runReplay(replay);
    expect(rerun.tick).toBe(world.tick);
    expect(hashWorld(rerun)).toBe(replay.finalHash);
    expect(rerun.ship).toEqual(world.ship);
    expect(rerun.stats).toEqual(world.stats);
  });

  it('survives a trip through the file format', () => {
    const { replay } = recordRandomRun(9, 3, 30);
    const loaded = parseReplay(serializeReplay(replay));
    expect(loaded).toEqual(replay);
    expect(hashWorld(runReplay(loaded))).toBe(replay.finalHash);
  });

  it('is not affected by later edits to the live tuning', () => {
    const world = createWorld(1, createTuning());
    world.tuning.flight.maxTurnRate = 399;
    const recorder = startRecording(world);
    for (let i = 0; i < 60; i++) {
      recorder.record(world.tick, world.actions);
      stepWorld(world, DT);
    }
    const replay = recorder.finish(world);
    expect(replay.tuning.flight.maxTurnRate).toBe(399);
    world.tuning.flight.maxTurnRate = 100;
    expect(replay.tuning.flight.maxTurnRate).toBe(399);
  });
});

describe('recorder and player', () => {
  it('stores only input changes (run-length) and the player restores them tick by tick', () => {
    const world = createWorld(1, createTuning());
    const recorder = startRecording(world);
    for (let i = 0; i < 100; i++) {
      world.actions.fire = i >= 10 && i < 50;
      world.actions.throttle = i >= 70 ? 1 : 0;
      recorder.record(world.tick, world.actions);
      stepWorld(world, DT);
    }
    const replay = recorder.finish(world);
    expect(replay.inputs.map((c) => c.tick)).toEqual([0, 10, 50, 70]);
    const out = createActions();
    const player = createPlayer(replay);
    const seen: boolean[] = [];
    for (let t = 0; t < 100; t++) {
      player.apply(out, t);
      seen.push(out.fire);
    }
    expect(seen.slice(0, 10).every((f) => !f)).toBe(true);
    expect(seen.slice(10, 50).every((f) => f)).toBe(true);
    expect(seen.slice(50).every((f) => !f)).toBe(true);
    player.apply(out, 99);
    expect(out.throttle).toBe(1);
  });

  it('records relative to where the recording started (after restartWorld)', () => {
    const world = createWorld(1, createTuning());
    for (let i = 0; i < 30; i++) stepWorld(world, DT);
    restartWorld(world, 77);
    expect(world.tick).toBe(0);
    expect(world.seed).toBe(77);
    const recorder = startRecording(world);
    world.actions.fire = true;
    for (let i = 0; i < 20; i++) {
      recorder.record(world.tick, world.actions);
      stepWorld(world, DT);
    }
    const replay = recorder.finish(world);
    expect(replay.inputs[0]!.tick).toBe(0);
    expect(hashWorld(runReplay(replay))).toBe(replay.finalHash);
  });

  it('restartWorld keeps the tuning object and the best trial time', () => {
    const tuning = createTuning();
    const world = createWorld(1, tuning, 12.5);
    restartWorld(world, 2);
    expect(world.tuning).toBe(tuning);
    expect(world.trial.best).toBe(12.5);
  });
});

describe('a run replay', () => {
  const veterans = [
    { id: 1, name: 'Old Hand', trait: 'steady' as const, kills: 9 },
    { id: 2, name: 'Ace Mover', trait: 'bold' as const, kills: 4 },
  ];

  /** Records a run from its Start screen: menu presses (veteran tick, Start, pick) then random flying. */
  function recordRun(seed: number): { world: World; replay: Replay } {
    const world = createWorld(seed, createTuning());
    world.tuning.run.playerHull = 20;
    world.tuning.fighter.waveDelay = 2;
    world.tuning.fighter.health = 1;
    enterStartScreen(world);
    offerVeterans(world, veterans);
    const recorder = startRecording(world);
    const rng = createRng(seed + 5);
    const a = world.actions;
    for (let i = 0; i < 60 * 90; i++) {
      if (world.run.phase === 'battle') {
        if (i % 20 === 0) {
          a.steerX = rng.range(-1, 1);
          a.throttle = rng.range(0, 1);
          a.fire = rng.next() < 0.8;
        }
        a.menuSelect = a.menuUp = a.menuDown = a.menuBack = false;
      } else {
        a.menuSelect = i % 12 === 0;
        a.menuDown = i % 30 === 7;
      }
      recorder.record(world.tick, world.actions);
      stepWorld(world, DT);
    }
    return { world, replay: recorder.finish(world) };
  }

  it('stores how the world started and replays menu choices to the same final hash', () => {
    const { world, replay } = recordRun(4);
    expect(replay.start.mode).toBe('run');
    expect(replay.start.veterans).toHaveLength(2);
    expect(world.run.battle).toBeGreaterThan(0); // the menus really advanced the run
    expect(hashWorld(runReplay(parseReplay(serializeReplay(replay))))).toBe(replay.finalHash);
  });

  it('rejects a replay without a valid start', () => {
    const { replay } = recordRun(4);
    const bad = JSON.parse(serializeReplay(replay)) as Record<string, unknown>;
    bad.start = { mode: 'nope', veterans: [] };
    expect(() => parseReplay(JSON.stringify(bad))).toThrow(/start/);
  });
});

describe('parseReplay', () => {
  const good = (): Replay => recordRandomRun(1, 1, 5).replay;
  const text = (mutate: (r: Record<string, unknown>) => void): string => {
    const r = JSON.parse(serializeReplay(good())) as Record<string, unknown>;
    mutate(r);
    return JSON.stringify(r);
  };

  it('rejects bad files loudly', () => {
    expect(() => parseReplay('nope')).toThrow(/JSON/);
    expect(() => parseReplay('{"a":1}')).toThrow(/Not a Starfighter replay/);
    expect(() => parseReplay(text((r) => (r.version = 99)))).toThrow(/version/);
    expect(() => parseReplay(text((r) => (r.seed = 1.5)))).toThrow(/seed/);
    expect(() => parseReplay(text((r) => delete r.tuning))).toThrow(/tuning/);
    expect(() =>
      parseReplay(text((r) => ((r.tuning as { flight: { grip: number } }).flight.grip = 9999))),
    ).toThrow(/outside/);
    expect(() =>
      parseReplay(
        text((r) => ((r.tuning as { flight: { steering: string } }).flight.steering = 'x')),
      ),
    ).toThrow(/one of/);
    expect(() => parseReplay(text((r) => (r.inputs = 'no')))).toThrow(/list/);
    expect(() =>
      parseReplay(text((r) => ((r.inputs as { tick: number }[])[0]!.tick = 9999))),
    ).toThrow(/order/);
    expect(() =>
      parseReplay(
        text((r) => ((r.inputs as { actions: { fire: unknown } }[])[0]!.actions.fire = 'yes')),
      ),
    ).toThrow(/bad value/);
  });
});

describe('prototype 2 state in the hash', () => {
  it('changes when lock, missile, fighter or squadron state changes', () => {
    const world = createWorld(1, createTuning());
    const base = hashWorld(world);
    world.lockon.locks.push(3);
    const withLock = hashWorld(world);
    expect(withLock).not.toBe(base);
    world.missiles.spawn();
    const withMissile = hashWorld(world);
    expect(withMissile).not.toBe(withLock);
    spawnFighter(world, 1, 2, 0);
    const withFighter = hashWorld(world);
    expect(withFighter).not.toBe(withMissile);
    world.squadron.formation = 'spread';
    expect(hashWorld(world)).not.toBe(withFighter);
  });
});
