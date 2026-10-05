import { expect, it } from 'vitest';
import { presentation as def } from '../../data/styles/anime-spectacle/presentation';
import { createTuning } from '../../data/tuning';
import { hashWorld } from '../../src/core/replay/hash';
import { enterStartScreen } from '../../src/core/run/run';
import { createWorld, stepWorld } from '../../src/core/world/world';
import {
  clearBanners,
  createBanners,
  feedBanners,
  stepBanners,
} from '../../src/ui/spectacle/banners';
import { createCombo, feedCombo, stepCombo } from '../../src/ui/spectacle/combo';
import { commWindows } from '../../src/ui/spectacle/comm';
import {
  createFeel,
  feedFeel,
  feelOutput,
  observeTurn,
  stepFeel,
} from '../../src/ui/spectacle/feel';
import { collectIndicators, type Indicator } from '../../src/ui/spectacle/indicators';
import { PRESETS, type PresetName } from '../../src/ui/spectacle/settings';

const DT = 1 / 60;

/** Runs a run-mode world for 40 seconds; with `preset` the whole presentation layer watches every step, as the game does. */
function finalHash(preset: PresetName | null): string {
  const world = createWorld(4242, createTuning());
  enterStartScreen(world);
  const a = world.actions;
  const feel = createFeel();
  const combo = createCombo();
  const banners = createBanners();
  const out: Indicator[] = [];
  const st = preset ? PRESETS[preset] : PRESETS.full;
  for (let i = 0; i < 40 * 60; i++) {
    if (world.run.phase !== 'battle') {
      a.menuSelect = i % 30 === 0; // start the run, then take every pick
    } else {
      a.menuSelect = false;
      if (i % 20 === 0) {
        a.steerX = Math.sin(i / 37);
        a.steerY = Math.cos(i / 53);
        a.throttle = 1;
        a.fire = true;
        a.launch = i % 120 === 0;
      }
    }
    stepWorld(world, DT);
    if (!preset) continue;
    const events = world.events.events;
    feedFeel(feel, events, def, st);
    observeTurn(feel, world.ship.heading, DT, def);
    stepFeel(feel, DT, def, st, world.run.hull / world.tuning.run.playerHull);
    feelOutput(feel, def, st, world.time, 16 / 9);
    feedCombo(combo, events, (id) => world.pilots.roster.find((p) => p.id === id)?.name, def);
    stepCombo(combo, DT, def);
    feedBanners(
      banners,
      events,
      {
        waveTotal: world.run.waveTotal,
        battles: world.tuning.run.battleCount,
        pilotName: (id) => world.pilots.roster.find((p) => p.id === id)?.name,
      },
      def,
    );
    stepBanners(banners, DT);
    if (world.run.phase !== 'battle') clearBanners(banners);
    collectIndicators(
      out,
      world,
      { x: world.camera.x, y: world.camera.y },
      { width: world.camera.view, height: world.camera.view / world.camera.aspect },
      { width: 1280, height: 720 },
      world.tuning.hud,
    );
    commWindows([], world.pilots.roster);
  }
  return hashWorld(world);
}

it('the replay hash is identical with the presentation layer watching, in every preset', () => {
  const bare = finalHash(null);
  for (const preset of ['full', 'calm', 'overdrive', 'off'] as const)
    expect(finalHash(preset)).toBe(bare);
});
