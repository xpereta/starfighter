import { createTuning } from '../../data/tuning';
import { createWorld, stepWorld } from '../core/world/world';
import { createInput } from '../input/input';
import { createHud } from '../render/hud/hud';
import { createRenderer } from '../render/renderer';
import { createFixedLoop } from './loop';
import { loadSave, SAVE_VERSION, storeSave } from './save';

const save = loadSave();
const world = createWorld(Date.now() >>> 0, createTuning(), save.bestTrialTime);
const renderer = createRenderer(document.body, world);
const hud = createHud(document.body);
const input = createInput();
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
  loop.advance((now - last) / 1000);
  last = now;
  renderer.render(world);
  hud.draw(world);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
