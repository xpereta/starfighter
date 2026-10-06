import { describe, expect, it } from 'vitest';
import { createTuning } from '../../data/tuning';
import { isCovered, partCenter } from '../../src/core/enemies/capital';
import { hashWorld } from '../../src/core/replay/hash';
import { createRng } from '../../src/core/rng/rng';
import { devJumpTo } from '../../src/core/run/dev-actions';
import { enterStartScreen } from '../../src/core/run/run';
import { createWorld, stepWorld, type World } from '../../src/core/world/world';
import { checkCapital as check, defs } from './capital-helpers';

const DT = 1 / 60;
const MAX_STEPS = 60 * 600; // ten simulated minutes: a battle must end well before this

describe('battle 4 through the real run flow', () => {
  function battle4(seed: number): { world: World; steps: number; maxFighters: number } {
    const tuning = createTuning();
    tuning.run.playerHull = 100000; // survive: the point is the flow, not the flying
    const world = createWorld(seed, tuning);
    enterStartScreen(world);
    devJumpTo(world, { kind: 'battle', n: 4 });
    const rng = createRng(seed + 1);
    let steps = 0;
    let maxFighters = 0;
    const cap = (): NonNullable<World['enemies']['capital']> => world.enemies.capital!;
    expect(cap()).not.toBeNull();
    while (world.run.phase === 'battle' && steps < MAX_STEPS) {
      steps++;
      // Fly at the capital ship: the nearest part that can be hit, with the ship parked in range.
      let best = -1;
      let bestD = Infinity;
      defs.forEach((_d, i) => {
        if (!cap().parts[i]!.alive || isCovered(cap(), i)) return;
        const c = { x: 0, y: 0 };
        partCenter(c, cap(), defs[i]!);
        const d = Math.hypot(c.x - world.ship.x, c.y - world.ship.y);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      if (best >= 0 && cap().phase === 0) {
        const c = { x: 0, y: 0 };
        partCenter(c, cap(), defs[best]!);
        const aim = Math.atan2(c.y - world.ship.y, c.x - world.ship.x);
        world.ship.heading = aim;
        if (bestD > 600) {
          world.ship.x += Math.cos(aim) * 40; // close in 2400 u/s: the ship is parked, not flown
          world.ship.y += Math.sin(aim) * 40;
        }
        world.actions.fire = true;
        world.actions.launch = steps % 300 === 0;
      }
      world.actions.evade = rng.next() < 0.02;
      stepWorld(world, DT);
      maxFighters = Math.max(maxFighters, world.fighters.filter((f) => f.alive).length);
      if (world.enemies.capital) check(world);
    }
    return { world, steps, maxFighters };
  }

  it('the capital ship appears at the arena edge and the battle is won by its core', () => {
    const { world, steps, maxFighters } = battle4(5);
    expect(world.run.phase, `battle 4 still on after ${steps} steps`).toBe('end');
    expect(world.run.result).toBe('victory');
    expect(world.enemies.capital!.phase).toBe(2);
    expect(maxFighters).toBeGreaterThan(0); // the escorts came
  });

  it('is deterministic through the run flow', () => {
    const a = battle4(9);
    const b = battle4(9);
    expect(hashWorld(a.world)).toBe(hashWorld(b.world));
    expect(a.steps).toBe(b.steps);
  });

  it('starts at the edge of the arena with its hull inside, escort wings on a timer, lancers halfway', () => {
    const tuning = createTuning();
    tuning.run.playerHull = 100000;
    const world = createWorld(2, tuning);
    enterStartScreen(world);
    devJumpTo(world, { kind: 'battle', n: 4 });
    const cap = world.enemies.capital!;
    const arena = tuning.flight.arenaRadius;
    expect(Math.hypot(cap.x, cap.y)).toBeCloseTo(
      arena - tuning.capital.hullRadius - tuning.capital.edgeMargin,
      0,
    );
    expect(world.run).toMatchObject({ battle: 4, wave: 1, waveTotal: 1 });
    // The first wing comes with the ship, the second after the delay, the lancers halfway or on the fallback timer.
    stepWorld(world, DT);
    const first = world.fighters.filter((f) => f.alive).length;
    expect(first).toBe(tuning.capital.escortWingSize);
    expect(cap.lancersSent).toBe(false);
    world.ship.x = cap.x; // pretend the ship is already near the capital: halfway is past
    world.ship.y = cap.y + 2000;
    for (let i = 0; i < 60 * (tuning.capital.escortWingDelay + 1); i++) stepWorld(world, DT);
    expect(cap.wingsSent).toBe(tuning.capital.escortWings);
    expect(cap.lancersSent).toBe(true);
  });
});
