import { expect, it } from 'vitest';
import { createTuning } from '../../data/tuning';
import { hashWorld } from '../../src/core/replay/hash';
import { createWorld, stepWorld } from '../../src/core/world/world';
import { qualityPresets } from '../../data/quality';
import { createDeathFx } from '../../src/render/fx/death-fx';
import { initStyle, styleIds } from '../../src/render/style-active';

const DT = 1 / 60;

/** Runs the sim; with `withFx` the render-side death effects watch every step, as the game does. */
function finalHash(withFx = false): string {
  const world = createWorld(777, createTuning());
  const fx = withFx
    ? createDeathFx(qualityPresets.high, world, { flash: () => {}, hitStop: () => {} })
    : null;
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
    if (fx) {
      fx.consume(world.events.events);
      fx.update(DT);
    }
  }
  fx?.dispose();
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

it('the hash is also identical with the death effects watching every step, under every style', () => {
  const plainHash = (initStyle('?style=plain', null), finalHash(false));
  for (const id of styleIds()) {
    initStyle(`?style=${id}`, null);
    expect(finalHash(true)).toBe(plainHash);
  }
  initStyle('', null);
});
