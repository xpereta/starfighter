import { expect, it } from 'vitest';
import { CAPITAL_PARTS } from '../../data/content/capital';
import { createTuning } from '../../data/tuning';
import { spawnCapitalAt } from '../../src/core/enemies/capital-battle';
import { stepCapitalBullets } from '../../src/core/enemies/capital-hits';
import { createWorld, stepWorld } from '../../src/core/world/world';

const DT = 1 / 60;

/**
 * Cost of the capital ship: the hit test is the hot path (every bullet, every step). Measured here
 * with the bullet pool full (400 bullets) inside the hull, the worst case: broad phase first, then at
 * most one distance test per part. The bound is generous (CI machines are slow); `CAPITAL_COST=1`
 * prints the numbers.
 */
it('hit tests against all parts stay cheap with a full bullet pool inside the hull', () => {
  const world = createWorld(1, createTuning());
  spawnCapitalAt(world, 1500, 0);
  const cap = world.enemies.capital!;
  const reps = 2000;
  let hits = 0;
  const t0 = performance.now();
  for (let r = 0; r < reps; r++) {
    // Refill the pool with bullets scattered over the hull each rep: most hit something and are spent.
    while (world.bullets.count < world.bullets.capacity) {
      const i = world.bullets.spawn();
      const a = (i * 2.399963) % (Math.PI * 2);
      const d = (i % 40) * 17;
      world.bullets.data.x[i] = cap.x + Math.cos(a) * d;
      world.bullets.data.y[i] = cap.y + Math.sin(a) * d;
      world.bullets.data.damage[i] = 0; // no damage: the parts never die, the cost stays the same
    }
    const before = world.bullets.count;
    stepCapitalBullets(world);
    hits += before - world.bullets.count;
  }
  const perStep = (performance.now() - t0) / reps;
  if (process.env.CAPITAL_COST) {
    process.stdout.write(
      `COST parts ${CAPITAL_PARTS.length}, bullets ${world.bullets.capacity}, hits ${hits}: ${(perStep * 1000).toFixed(0)} us per step\n`,
    );
  }
  expect(hits).toBeGreaterThan(0);
  expect(perStep).toBeLessThan(2); // ms; the whole step budget is 16.7 ms
});

it('a whole world step with the capital ship firing costs little more than without', () => {
  const run = (withCapital: boolean): number => {
    const world = createWorld(2, createTuning());
    if (withCapital) {
      spawnCapitalAt(world, 1500, 0);
      world.enemies.capital!.heading = Math.PI / 2;
    }
    world.ship.x = 900;
    world.ship.y = 0;
    stepWorld(world, DT);
    const t0 = performance.now();
    for (let i = 0; i < 1200; i++) {
      world.actions.fire = true;
      world.ship.x = 900;
      world.ship.y = 0;
      stepWorld(world, DT);
    }
    return (performance.now() - t0) / 1200;
  };
  run(false); // warm up
  const base = run(false);
  const with_ = run(true);
  if (process.env.CAPITAL_COST) {
    process.stdout.write(
      `COST world step: ${(base * 1000).toFixed(0)} us without, ${(with_ * 1000).toFixed(0)} us with the capital ship\n`,
    );
  }
  expect(with_).toBeLessThan(5); // ms
});
