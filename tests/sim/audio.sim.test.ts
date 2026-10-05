import { expect, it } from 'vitest';
import { createMixConfig } from '../../data/audio/mix';
import { createTuning } from '../../data/tuning';
import { createAudioEngine } from '../../src/audio/engine';
import { createFakeBackend } from '../../src/audio/fake-backend';
import { hashWorld } from '../../src/core/replay/hash';
import { createWorld, stepWorld } from '../../src/core/world/world';
import { activeStyle, initStyle, styleIds } from '../../src/render/style-active';
import { SOUND_EVENT_KEYS } from '../../src/render/style';

const DT = 1 / 60;

function run(withAudio: boolean): { hash: string; plays: number } {
  const world = createWorld(777, createTuning());
  const backend = createFakeBackend();
  const engine = createAudioEngine({
    backend,
    table: () => activeStyle().sounds,
    mix: createMixConfig(),
  });
  engine.unlock();
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
    backend.now += DT;
    if (withAudio) engine.consumeEvents(world.events.events, world.ship);
  }
  return { hash: hashWorld(world), plays: backend.played.length };
}

it('the final state hash is identical with audio on or off, under every style', () => {
  for (const id of styleIds()) {
    initStyle(`?style=${id}`, null);
    const off = run(false);
    const on = run(true);
    expect(on.hash).toBe(off.hash);
    expect(off.plays).toBe(0);
  }
  initStyle('', null);
});

it('every style gives every event a sound or an explicit silent', () => {
  for (const id of styleIds()) {
    initStyle(`?style=${id}`, null);
    for (const k of SOUND_EVENT_KEYS) expect(activeStyle().sounds[k]).toBeDefined();
  }
  initStyle('', null);
});
