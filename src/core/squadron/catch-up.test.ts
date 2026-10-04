import { describe, expect, it } from 'vitest';
import { createTuning } from '../../../data/tuning';
import { createFlightConfig } from '../../../data/tuning/flight';
import { createSquadronConfig } from '../../../data/tuning/squadron';
import { hashWorld } from '../replay/hash';
import { createWorld, stepWorld, type World } from '../world/world';
import { boostFlight, catchUpFactor, slotFrame, slotPosition } from './formation';

const DT = 1 / 60;
const cfg = createSquadronConfig();

describe('catchUpFactor', () => {
  it('is 0 inside the hold radius and at its edge, 1 a full catch-up range beyond it', () => {
    expect(catchUpFactor(0, cfg)).toBe(0);
    expect(catchUpFactor(cfg.slotHoldRadius, cfg)).toBe(0);
    expect(catchUpFactor(cfg.slotHoldRadius + cfg.catchUpRange, cfg)).toBe(1);
    expect(catchUpFactor(1e6, cfg)).toBe(1);
  });

  it('rises smoothly and monotonically with distance', () => {
    let last = -1;
    for (let d = 0; d <= cfg.slotHoldRadius + cfg.catchUpRange + 100; d += 25) {
      const t = catchUpFactor(d, cfg);
      expect(t).toBeGreaterThanOrEqual(last);
      last = t;
    }
    expect(catchUpFactor(cfg.slotHoldRadius + cfg.catchUpRange / 2, cfg)).toBeCloseTo(0.5);
  });
});

describe('boostFlight', () => {
  const base = createFlightConfig();

  it('is the unchanged flight model at t = 0, and never touches the base', () => {
    const snapshot = { ...base };
    const out = boostFlight({ ...base }, base, cfg, 0);
    expect(out).toEqual(base);
    boostFlight({ ...base }, base, cfg, 1);
    expect(base).toEqual(snapshot);
  });

  it('scales acceleration, top speed and turn rates fully at t = 1 and halfway at t = 0.5', () => {
    const full = boostFlight({ ...base }, base, cfg, 1);
    expect(full.accel).toBeCloseTo(base.accel * cfg.catchUpAccel);
    expect(full.brake).toBeCloseTo(base.brake * cfg.catchUpAccel);
    expect(full.maxSpeed).toBeCloseTo(base.maxSpeed * cfg.catchUpSpeed);
    expect(full.maxTurnRate).toBeCloseTo(base.maxTurnRate * cfg.catchUpTurn);
    expect(full.turnAccel).toBeCloseTo(base.turnAccel * cfg.catchUpTurn);
    expect(full.grip).toBeCloseTo(base.grip * cfg.catchUpGrip);
    expect(full.gripAtMaxSpeed).toBeCloseTo(base.gripAtMaxSpeed * cfg.catchUpGrip);
    const half = boostFlight({ ...base }, base, cfg, 0.5);
    expect(half.accel).toBeCloseTo(base.accel * (1 + (cfg.catchUpAccel - 1) / 2));
    // Everything else is copied as is.
    expect(full.cornerSpeed).toBe(base.cornerSpeed);
    expect(full.steering).toBe(base.steering);
  });

  it('with all three scales at 1 there is no boost at any distance', () => {
    const none = { ...cfg, catchUpAccel: 1, catchUpSpeed: 1, catchUpTurn: 1, catchUpGrip: 1 };
    expect(boostFlight({ ...base }, base, none, 1)).toEqual(base);
  });
});

describe('wingmen keep up with a hard-flying player', () => {
  interface Move {
    seconds: number;
    throttle: number;
    rotate: number;
  }

  /** Flies a scripted maneuver and measures the wingmen's distance to their slots. */
  function fly(
    moves: Move[],
    boost: boolean,
  ): { mean: number; inside: number; recover: number; world: World } {
    const tuning = createTuning();
    tuning.fighter.waveSize = 0;
    tuning.arena.staticCount = 0;
    tuning.arena.droneCount = 0;
    tuning.arena.turretCount = 0;
    tuning.squadron.wingmanCount = 2;
    if (!boost)
      Object.assign(tuning.squadron, {
        catchUpAccel: 1,
        catchUpSpeed: 1,
        catchUpTurn: 1,
        catchUpGrip: 1,
      });
    const world = createWorld(7, tuning);
    stepWorld(world, DT); // creates the wingmen
    const slot = { x: 0, y: 0 };
    const frame = { x: 0, y: 0, heading: 0 };
    const worst = (): number =>
      Math.max(
        ...world.squadron.wingmen.map((w, i) => {
          slotPosition(
            slot,
            'tight',
            i,
            2,
            slotFrame(frame, world.ship, tuning.squadron.slotAnchor),
            tuning.squadron,
          );
          return Math.hypot(w.ship.x - slot.x, w.ship.y - slot.y);
        }),
      );
    let sum = 0;
    let inside = 0;
    let n = 0;
    for (const m of moves) {
      for (let i = 0; i < m.seconds * 60; i++) {
        world.actions.throttle = m.throttle;
        world.actions.rotate = m.rotate;
        stepWorld(world, DT);
        const d = worst();
        sum += d;
        n++;
        if (d < 200) inside++;
      }
    }
    world.actions.throttle = 0;
    world.actions.rotate = 0;
    let recover = Infinity;
    for (let i = 0; i < 60 * 10; i++) {
      stepWorld(world, DT);
      if (worst() < 120) {
        recover = (i + 1) / 60;
        break;
      }
    }
    return { mean: sum / n, inside: inside / n, recover, world };
  }

  const surges: Move[] = [
    { seconds: 4, throttle: 1, rotate: 0 },
    { seconds: 3, throttle: -1, rotate: 0 },
  ];
  const weave: Move[] = [0.4, -0.4, 0.4, -0.4].map((rotate) => ({
    seconds: 1.5,
    throttle: 0.3,
    rotate,
  }));
  const spin: Move[] = [{ seconds: 3, throttle: 0.5, rotate: 1 }];

  it('when the player speeds up and brakes, the boost keeps them much closer to their slots', () => {
    const withBoost = fly(surges, true);
    const without = fly(surges, false);
    expect(withBoost.mean).toBeLessThan(without.mean * 0.7);
    expect(withBoost.inside).toBeGreaterThan(0.95);
  });

  it('when the player weaves, they are in place far more of the time with the boost', () => {
    const withBoost = fly(weave, true);
    const without = fly(weave, false);
    expect(withBoost.inside).toBeGreaterThan(without.inside * 1.3);
  });

  it('after a hard spin they are back in their slots within a few seconds, and the boost has faded', () => {
    const { recover, world } = fly(spin, true);
    expect(recover).toBeLessThan(4);
    // A few seconds later still, they hold the slot and need no help.
    for (let i = 0; i < 60 * 4; i++) stepWorld(world, DT);
    for (const w of world.squadron.wingmen) expect(w.catchUp).toBeLessThan(0.3);
  });

  it('never exceeds the boosted top speed, and the boost state is part of the replay hash', () => {
    const { world } = fly(surges, true);
    const limit = world.tuning.flight.maxSpeed * world.tuning.squadron.catchUpSpeed + 1e-6;
    for (const w of world.squadron.wingmen) expect(w.ship.speed).toBeLessThanOrEqual(limit);
    const before = hashWorld(world);
    world.squadron.wingmen[0]!.catchUp += 0.25;
    expect(hashWorld(world)).not.toBe(before);
  });
});
