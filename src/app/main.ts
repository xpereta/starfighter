import { createTuning } from '../../data/tuning';
import { createWorld, stepWorld } from '../core/world/world';
import { createInput } from '../input/input';
import { createRenderer } from '../render/renderer';
import { createFixedLoop } from './loop';
import { loadSave, SAVE_VERSION, storeSave } from './save';

const save = loadSave();
const world = createWorld(Date.now() >>> 0, createTuning(), save.bestTrialTime);
const renderer = createRenderer(document.body, world);
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

/** Stopgap trial readout in the tab title until the HUD issue (#10) draws it. */
function trialTitle(): string {
  const { trial } = world;
  const best = trial.best === null ? '--' : trial.best.toFixed(1);
  if (!trial.active) return `Starfighter | T = time trial | best ${best}s`;
  const left = world.targets.filter((t) => t.kind === 'drone' && t.alive).length;
  return `Starfighter | TRIAL ${trial.time.toFixed(1)}s | drones left ${left} | best ${best}s`;
}

let last = performance.now();
function frame(now: number): void {
  input.poll(world.actions);
  world.camera.aspect = window.innerWidth / window.innerHeight || 1;
  loop.advance((now - last) / 1000);
  last = now;
  renderer.render(world);
  document.title = trialTitle();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
