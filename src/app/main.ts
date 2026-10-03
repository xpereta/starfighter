import { createTuning } from '../../data/tuning';
import { createWorld, stepWorld, type World } from '../core/world/world';
import { createInput } from '../input/input';
import { createHud } from '../render/hud/hud';
import { createRenderer } from '../render/renderer';
import { createFixedLoop } from './loop';
import { loadSave, SAVE_VERSION, storeSave } from './save';

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
let devTools: { draw(world: World, frameSeconds: number): void } | null = null;
if (devToolsEnabled) {
  void import('../dev').then((m) => {
    devTools = m.createDevTools(world, document.body);
  });
}

const loop = createFixedLoop((dt) => {
  stepWorld(world, dt);
  // Events live for one step; hand them to FX before the next step clears them.
  renderer.consumeEvents(world.events.events);
  if (world.trial.best !== save.bestTrialTime) {
    save.bestTrialTime = world.trial.best;
    storeSave({ version: SAVE_VERSION, bestTrialTime: save.bestTrialTime });
  }
});

let last = performance.now();
function frame(now: number): void {
  input.poll(world.actions);
  world.camera.aspect = window.innerWidth / window.innerHeight || 1;
  const previous = last;
  loop.advance((now - last) / 1000);
  last = now;
  renderer.render(world);
  hud.draw(world);
  devTools?.draw(world, (now - previous) / 1000);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
