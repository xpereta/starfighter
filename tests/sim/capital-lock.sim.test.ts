import { describe, expect, it } from 'vitest';
import { createTuning } from '../../data/tuning';
import { isCovered, PART_ID_BASE } from '../../src/core/enemies/capital';
import { spawnCapitalAt } from '../../src/core/enemies/capital-battle';
import { createWorld, stepWorld } from '../../src/core/world/world';

const DT = 1 / 60;

describe('lock-on and salvos on parts', () => {
  it('a lock set holds at most lockPartCap parts, all of them parts that can be hit', () => {
    const tuning = createTuning();
    tuning.capital.cruiseSpeed = 0;
    tuning.capital.fireScale = 0; // peace and quiet
    tuning.lockon.lockTime = 0.05;
    const world = createWorld(4, tuning);
    spawnCapitalAt(world, 1200, 0);
    const cap = world.enemies.capital!;
    world.ship.x = 0;
    world.ship.y = 0;
    world.ship.heading = 0;
    // Keep the ship pointing at the middle of the capital ship's hull while the lock set fills.
    for (let i = 0; i < 60 * 8; i++) {
      world.ship.x = 300;
      world.ship.y = 0;
      world.ship.heading = 0;
      stepWorld(world, DT);
    }
    const partLocks = world.lockon.locks.filter((id) => id >= PART_ID_BASE);
    expect(partLocks.length).toBeLessThanOrEqual(tuning.capital.lockPartCap);
    expect(partLocks.length).toBe(world.lockon.locks.length);
    expect(partLocks.length).toBeGreaterThan(0);
    for (const id of partLocks) {
      expect(isCovered(cap, id - PART_ID_BASE)).toBe(false);
    }
  });
});
