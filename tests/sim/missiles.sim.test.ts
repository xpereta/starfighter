import { expect, it } from 'vitest';
import { createTuning } from '../../data/tuning';
import { hashWorld } from '../../src/core/replay/hash';
import { createRng } from '../../src/core/rng/rng';
import { createWorld, stepWorld } from '../../src/core/world/world';

const DT = 1 / 60;

function play(seed: number) {
  const tuning = createTuning();
  tuning.arena.staticCount = 40;
  const world = createWorld(seed, tuning);
  // The world provides 2 wingmen by default (prototype 2 track B).
  // Unkillable targets keep the arena populated, so locks and hits keep happening.
  for (const t of world.targets) t.hp = t.maxHp = 1e9;
  const rng = createRng(555);
  const a = world.actions;
  let salvos = 0;
  let launched = 0;
  let hits = 0;
  for (let i = 0; i < 120 * 60; i++) {
    if (i % 20 === 0) {
      if (rng.next() < 0.7) {
        // A simple bot: mostly fly at the nearest target, so locks form and salvos get launched.
        let best = Infinity;
        for (const t of world.targets) {
          const d = Math.hypot(t.x - world.ship.x, t.y - world.ship.y);
          if (d < best) {
            best = d;
            a.steerX = (t.x - world.ship.x) / d;
            a.steerY = (t.y - world.ship.y) / d;
          }
        }
        a.throttle = -0.3; // a bit slower, to hold the lock
      } else {
        a.steerX = rng.range(-1, 1);
        a.steerY = rng.range(-1, 1);
        a.throttle = rng.range(-1, 1);
      }
      a.fire = rng.next() < 0.5;
      a.launch = rng.next() < 0.4; // pulses, so presses and releases both happen
    }
    stepWorld(world, DT);
    for (const e of world.events.events) {
      if (e.type === 'SalvoFired') salvos++;
      else if (e.type === 'MissileLaunched') launched++;
      else if (e.type === 'Hit') hits++;
    }
    const m = world.missiles;
    expect(m.count).toBeLessThanOrEqual(m.capacity);
    for (let j = 0; j < m.count; j++) {
      const d = m.data;
      expect(
        Number.isFinite(d.x[j]! + d.y[j]! + d.vx[j]! + d.vy[j]! + d.heading[j]! + d.speed[j]!),
      ).toBe(true);
      expect(d.speed[j]).toBeLessThanOrEqual(tuning.missiles.missileMaxSpeed + 1e-3);
      expect(d.life[j]).toBeGreaterThan(0);
    }
    expect(Number.isFinite(m.salvo.cooldown)).toBe(true);
  }
  return { world, salvos, launched, hits };
}

it('120 s of random play with locks, wingmen and salvos: no NaN, pool within cap, missiles hit things', () => {
  const { salvos, launched, hits } = play(21);
  expect(salvos).toBeGreaterThan(0);
  expect(launched).toBeGreaterThanOrEqual(salvos);
  expect(hits).toBeGreaterThan(0);
});

it('is deterministic: the same seed and inputs give the same final state', () => {
  expect(hashWorld(play(5).world)).toBe(hashWorld(play(5).world));
});
