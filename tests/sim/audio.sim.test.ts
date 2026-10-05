import { expect, it } from 'vitest';
import { createMixConfig } from '../../data/audio/mix';
import { createTuning } from '../../data/tuning';
import { createAudioEngine } from '../../src/audio/engine';
import { createFakeBackend } from '../../src/audio/fake-backend';
import { loopStateOf } from '../../src/audio/state';
import { enterStartScreen } from '../../src/core/run/run';
import { hashWorld } from '../../src/core/replay/hash';
import { createWorld, stepWorld } from '../../src/core/world/world';
import { activeStyle, initStyle, styleIds } from '../../src/render/style-active';
import { LOOP_KEYS, SOUND_EVENT_KEYS } from '../../src/render/style';

const DT = 1 / 60;

function run(withAudio: boolean): { hash: string; plays: number; loops: number } {
  const world = createWorld(777, createTuning());
  const backend = createFakeBackend();
  const engine = createAudioEngine({
    backend,
    table: () => activeStyle().sounds,
    loops: () => activeStyle().loops,
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
    if (withAudio) {
      engine.consumeEvents(world.events.events, world.ship);
      engine.setLoopState(loopStateOf(world), DT);
    }
  }
  return { hash: hashWorld(world), plays: backend.played.length, loops: backend.loopCalls };
}

/** A run: the Start screen, the menus and the first battle, with menu buttons pressed along the way. */
function runMode(withAudio: boolean): { hash: string; menuSounds: number } {
  const world = createWorld(31, createTuning());
  enterStartScreen(world);
  const backend = createFakeBackend();
  const engine = createAudioEngine({
    backend,
    table: () => activeStyle().sounds,
    loops: () => activeStyle().loops,
    mix: createMixConfig(),
  });
  engine.unlock();
  const a = world.actions;
  for (let i = 0; i < 12 * 60; i++) {
    a.menuDown = i % 30 === 5;
    a.menuUp = i % 30 === 20;
    a.menuSelect = i === 100;
    a.throttle = 1;
    a.fire = i > 200 && i % 2 === 0;
    stepWorld(world, DT);
    backend.now += DT;
    if (withAudio) {
      engine.consumeEvents(world.events.events, world.ship);
      engine.setLoopState(loopStateOf(world), DT);
    }
  }
  return {
    hash: hashWorld(world),
    menuSounds: backend.played.filter((p) => p.key.startsWith('Menu')).length,
  };
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

it('the run flow (menus, then a battle) has the same hash with audio on or off, and menu sounds play', () => {
  for (const id of styleIds()) {
    initStyle(`?style=${id}`, null);
    const off = runMode(false);
    const on = runMode(true);
    expect(on.hash).toBe(off.hash);
    expect(off.menuSounds).toBe(0);
    expect(on.menuSounds).toBeGreaterThan(0);
  }
  initStyle('', null);
});

it('every style gives every loop an entry or an explicit silent', () => {
  for (const id of styleIds()) {
    initStyle(`?style=${id}`, null);
    for (const k of LOOP_KEYS) expect(activeStyle().loops[k]).toBeDefined();
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
