import { expect, it } from 'vitest';
import { createTuning } from '../../data/tuning';
import { spawnFighter } from '../../src/core/ai/waves';
import { createWorld, stepWorld, type World } from '../../src/core/world/world';

const DT = 1 / 60;
const steps = (w: World, seconds: number): void => {
  for (let i = 0; i < Math.round(seconds / DT); i++) stepWorld(w, DT);
};

/** A dogfight in full swing: fighters, wingmen, a salvo in the air, locks, an order and a trial running. */
function dogfight(): World {
  const w = createWorld(21, createTuning());
  stepWorld(w, DT); // creates the wingmen
  spawnFighter(w, 900, 150, Math.PI);
  spawnFighter(w, -800, -300, 0);
  w.targets[0]!.x = w.ship.x + 500;
  w.targets[0]!.y = w.ship.y;
  w.lockon.locks.push(0);
  w.actions.launch = true;
  w.actions.attackOrder = true;
  w.actions.startTrial = true;
  w.actions.fire = true;
  stepWorld(w, DT);
  w.actions.launch = false;
  w.actions.attackOrder = false;
  w.actions.startTrial = false;
  steps(w, 6);
  w.squadron.formation = 'spread';
  return w;
}

it('a respawn brings back the whole squadron next to the player and clears every fight in progress', () => {
  const w = dogfight();
  w.squadron.wingmen[0]!.alive = false; // one wingman is down too
  w.squadron.wingmen[0]!.respawnTimer = 9;
  expect(w.fighters.length).toBeGreaterThan(0);

  w.actions.fire = false;
  w.actions.respawn = true;
  stepWorld(w, DT);
  w.actions.respawn = false;
  stepWorld(w, DT); // the wingmen are created on the next squadron step

  // The old fighters are gone; a respawn restarts the waves, so a fresh full-health wave starts at once
  // (far out at the arena edge, not on top of the player).
  expect(w.fighters).toHaveLength(w.tuning.fighter.waveSize);
  for (const f of w.fighters) {
    expect(f.alive).toBe(true);
    expect(f.hp).toBe(f.maxHp);
    expect(Math.hypot(f.x - w.ship.x, f.y - w.ship.y)).toBeGreaterThan(
      w.tuning.flight.arenaRadius * 0.5,
    );
  }
  expect(w.missiles.count).toBe(0);
  expect(w.missiles.salvo.pending).toEqual([]);
  expect(w.bullets.count + w.enemyShots.count).toBe(0);
  expect(w.lockon.locks).toEqual([]);
  expect(w.squadron.order).toBe('none');
  expect(w.squadron.formation).toBe('tight');
  expect(w.trial.active).toBe(false);
  // The whole squadron is back, alive, in formation distance of the player.
  expect(w.squadron.wingmen).toHaveLength(w.tuning.squadron.wingmanCount);
  for (const wingman of w.squadron.wingmen) {
    expect(wingman.alive).toBe(true);
    expect(wingman.hp).toBe(w.tuning.squadron.health);
    expect(Math.hypot(wingman.ship.x - w.ship.x, wingman.ship.y - w.ship.y)).toBeLessThan(400);
  }
});

it('after a respawn the squadron is intact while the fresh wave closes in', () => {
  const w = dogfight();
  w.actions.respawn = true;
  stepWorld(w, DT);
  w.actions.respawn = false;
  steps(w, 8);
  expect(w.fighters.some((f) => f.alive)).toBe(true);
  expect(w.squadron.wingmen.every((x) => x.alive)).toBe(true);
  for (const f of w.fighters) expect(Number.isFinite(f.x + f.y)).toBe(true);
});
