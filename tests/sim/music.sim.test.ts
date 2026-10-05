import { expect, it } from 'vitest';
import { createMixConfig } from '../../data/audio/mix';
import { createTuning } from '../../data/tuning';
import { music } from '../../data/styles/anime-spectacle/music';
import { createAudioEngine } from '../../src/audio/engine';
import { createFakeBackend } from '../../src/audio/fake-backend';
import { loopStateOf, musicInputOf } from '../../src/audio/state';
import { hashWorld } from '../../src/core/replay/hash';
import { enterStartScreen } from '../../src/core/run/run';
import { createWorld, stepWorld } from '../../src/core/world/world';
import { silentSoundTable } from '../../src/render/style';

const DT = 1 / 60;

/** The run flow (Start screen, then a battle with fighters) with the adaptive score on or off. */
function run(withMusic: boolean) {
  const world = createWorld(31, createTuning());
  enterStartScreen(world);
  const backend = createFakeBackend();
  const engine = createAudioEngine({
    backend,
    table: () => silentSoundTable(),
    music: () => music,
    mix: createMixConfig(),
  });
  engine.unlock();
  const a = world.actions;
  const scenes = new Set<string>();
  let maxIntensity = 0;
  for (let i = 0; i < 40 * 60; i++) {
    a.menuSelect = i === 100;
    a.steerX = Math.sin(i / 41);
    a.throttle = 1;
    a.fire = i > 200 && i % 2 === 0;
    stepWorld(world, DT);
    backend.now += DT;
    if (withMusic) {
      engine.consumeEvents(world.events.events, world.ship);
      engine.setLoopState(loopStateOf(world), DT);
      const input = musicInputOf(world);
      scenes.add(input.scene);
      engine.setMusicState(input, DT);
      maxIntensity = Math.max(maxIntensity, engine.musicStatus?.intensity ?? 0);
    }
  }
  return {
    hash: hashWorld(world),
    bars: backend.bars.length,
    stingers: backend.stingers.map((s) => s.key),
    scenes,
    maxIntensity,
  };
}

it('the adaptive score reads the world but never changes it: same hash with the music on or off', () => {
  const off = run(false);
  const on = run(true);
  expect(on.hash).toBe(off.hash);
  expect(off.bars).toBe(0);
});

it('the music follows the run: menu, then a battle that starts with a stinger and raises the intensity', () => {
  const on = run(true);
  expect(on.scenes.has('menu')).toBe(true);
  expect(on.scenes.has('flight')).toBe(true);
  expect(on.bars).toBeGreaterThan(10);
  expect(on.stingers).toContain('battleStart');
  expect(on.maxIntensity).toBeGreaterThan(0.2);
});
