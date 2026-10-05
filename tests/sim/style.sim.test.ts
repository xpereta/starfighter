import { expect, it } from 'vitest';
import { createTuning } from '../../data/tuning';
import { hashWorld } from '../../src/core/replay/hash';
import { createWorld, stepWorld } from '../../src/core/world/world';
import { initStyle, styleIds } from '../../src/render/style-active';

const DT = 1 / 60;

function finalHash(): string {
  const world = createWorld(777, createTuning());
  const a = world.actions;
  for (let i = 0; i < 20 * 60; i++) {
    if (i % 20 === 0) {
      a.steerX = Math.sin(i / 37);
      a.steerY = Math.cos(i / 53);
      a.throttle = 1;
      a.fire = i % 40 === 0;
      a.evade = i % 200 === 0;
    }
    stepWorld(world, DT);
  }
  return hashWorld(world);
}

it('the final state hash is identical under every style: style never touches core', () => {
  const hashes = styleIds().map((id) => {
    initStyle(`?style=${id}`, null);
    return finalHash();
  });
  expect(hashes.length).toBeGreaterThan(0);
  expect(new Set(hashes).size).toBe(1);
  initStyle('', null);
});
