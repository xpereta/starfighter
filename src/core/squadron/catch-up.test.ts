import { describe, expect, it } from 'vitest';
import { createTuning } from '../../../data/tuning';
import { createFlightConfig } from '../../../data/tuning/flight';
import { createSquadronConfig } from '../../../data/tuning/squadron';
import { hashWorld } from '../replay/hash';
import { createWorld, stepWorld, type World } from '../world/world';
import { boostFlight, catchUpFactor, slotPosition } from './formation';

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
    const half = boostFlight({ ...base }, base, cfg, 0.5);
    expect(half.accel).toBeCloseTo(base.accel * (1 + (cfg.catchUpAccel - 1) / 2));
    // Everything else is copied as is.
    expect(full.grip).toBe(base.grip);
    expect(full.cornerSpeed).toBe(base.cornerSpeed);
    expect(full.steering).toBe(base.steering);
  });

  it('with all three scales at 1 there is no boost at any distance', () => {
    const none = { ...cfg, catchUpAccel: 1, catchUpSpeed: 1, catchUpTurn: 1 };
    expect(boostFlight({ ...base }, base, none, 1)).toEqual(base);
  });
});

describe('wingmen keep up with a hard-flying player', () => {
  function flyManeuver(boost: boolean): { peak: number; settled: number; world: World } {
    const tuning = createTuning();
    tuning.fighter.waveSize = 0;
    tuning.arena.staticCount = 0;
    tuning.arena.droneCount = 0;
    tuning.arena.turretCount = 0;
    tuning.squadron.wingmanCount = 2;
    if (!boost) {
      tuning.squadron.catchUpAccel = 1;
      tuning.squadron.catchUpSpeed = 1;
      tuning.squadron.catchUpTurn = 1;
    }
    const world = createWorld(7, tuning);
    stepWorld(world, DT); // creates the wingmen
    const slot = { x: 0, y: 0 };
    const distances = (): number[] =>
      world.squadron.wingmen.map((w, i) => {
        slotPosition(slot, 'tight', i, 2, world.ship, tuning.squadron);
        return Math.hypot(w.ship.x - slot.x, w.ship.y - slot.y);
      });
    let peak = 0;
    for (let i = 0; i < 60 * 5; i++) {
      world.actions.throttle = 1; // accelerate hard...
      world.actions.rotate = 1; // ...while spinning
      stepWorld(world, DT);
      peak = Math.max(peak, ...distances());
    }
    world.actions.throttle = 0;
    world.actions.rotate = 0;
    for (let i = 0; i < 60 * 8; i++) stepWorld(world, DT);
    return { peak, settled: Math.max(...distances()), world };
  }

  it('the boost keeps them much closer during the maneuver than no boost', () => {
    const withBoost = flyManeuver(true);
    const without = flyManeuver(false);
    expect(withBoost.peak).toBeLessThan(without.peak * 0.8);
  });

  it('they settle back into their slots afterwards, and the boost has faded out', () => {
    const { settled, world } = flyManeuver(true);
    expect(settled).toBeLessThan(world.tuning.squadron.slotHoldRadius * 4);
    for (const w of world.squadron.wingmen) expect(w.catchUp).toBeLessThan(0.3);
  });

  it('never exceeds the boosted top speed, and the boost state is part of the replay hash', () => {
    const { world } = flyManeuver(true);
    const limit = world.tuning.flight.maxSpeed * world.tuning.squadron.catchUpSpeed + 1e-6;
    for (const w of world.squadron.wingmen) expect(w.ship.speed).toBeLessThanOrEqual(limit);
    const before = hashWorld(world);
    world.squadron.wingmen[0]!.catchUp += 0.25;
    expect(hashWorld(world)).not.toBe(before);
  });
});
