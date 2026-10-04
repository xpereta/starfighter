import { createTuning } from '../../data/tuning';
import { applyFinishedRun, veteranOffers } from '../core/meta/meta';
import { enterStartScreen, offerVeterans } from '../core/run/run';
import { createWorld, stepWorld, type World } from '../core/world/world';
import { createInput } from '../input/input';
import { createHud } from '../render/hud/hud';
import { createRenderer } from '../render/renderer';
import { menuVisible } from '../ui/menu-model';
import { maskFlightActions } from '../ui/menu-nav';
import { createHudView } from '../ui/hud-view';
import { createMenuView } from '../ui/menu-view';
import { createFixedLoop } from './loop';
import { loadSave, saveIsFromNewerVersion, storeSave } from './save';

const save = loadSave();

/**
 * Dev tools (tuning panel, debug overlay) are a separate lazy chunk: on with `?dev` (always in
 * `npm run dev`), so preview URLs can tune. Build with VITE_DEV_TOOLS=false to strip them entirely.
 */
const devToolsEnabled =
  import.meta.env.VITE_DEV_TOOLS !== 'false' &&
  (import.meta.env.DEV || new URLSearchParams(window.location.search).has('dev'));

const world = createWorld(Date.now() >>> 0, createTuning(), save.bestTrialTime);
const renderer = createRenderer(document.body, world);
const hud = createHud(document.body);
const input = createInput();
const menus = createMenuView(document.body, () => save.meta.bestRun);
const runHud = createHudView(document.body, world.seed);
// The game starts on the Start screen (a run); `?practice` opens the practice field instead.
const practice = new URLSearchParams(window.location.search).has('practice');
// A save written by a newer version of the game is read as empty and never overwritten.
const canStore = !saveIsFromNewerVersion();
let offered = false;
if (!practice) enterStartScreen(world);
let devTools: {
  beforeStep(world: World): void;
  draw(world: World, frameSeconds: number): void;
} | null = null;
if (devToolsEnabled) {
  void import('../dev').then((m) => {
    devTools = m.createDevTools(world, document.body);
  });
}

const loop = createFixedLoop((dt) => {
  devTools?.beforeStep(world); // replay: record the inputs about to be used, or inject recorded ones
  stepWorld(world, dt);
  // Events live for one step; hand them to FX before the next step clears them.
  renderer.consumeEvents(world.events.events);
  runHud.step(world, dt);
  if (world.run.mode === 'run') {
    // Offer the saved veterans once per Start screen (a restart gets the updated roster).
    if (world.run.phase === 'start' && !offered) {
      offerVeterans(world, veteranOffers(save.meta));
      offered = true;
    }
    for (const e of world.events.events) {
      if (e.type !== 'RunEnded') continue;
      save.meta = applyFinishedRun(
        save.meta,
        world.pilots.roster,
        world.run,
        world.tuning.pilots.veteranCap,
      );
      offered = false;
      if (canStore) storeSave(save);
    }
  }
  if (world.trial.best !== save.bestTrialTime) {
    save.bestTrialTime = world.trial.best;
    if (canStore) storeSave(save);
  }
});

let last = performance.now();
function frame(now: number): void {
  input.poll(world.actions);
  if (menuVisible(world.run)) maskFlightActions(world.actions); // the keys that fly never act behind a menu
  world.camera.aspect = window.innerWidth / window.innerHeight || 1;
  const previous = last;
  loop.advance((now - last) / 1000);
  last = now;
  renderer.render(world);
  hud.draw(world);
  menus.draw(world);
  runHud.draw(world);
  devTools?.draw(world, (now - previous) / 1000);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
