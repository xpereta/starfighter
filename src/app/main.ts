import { createTuning } from '../../data/tuning';
import { createRenderer } from '../render/renderer';
import { createWorld, stepWorld } from '../core/world/world';
import { createInput } from '../input/input';
import { createFixedLoop } from './loop';

const world = createWorld(Date.now() >>> 0, createTuning());
const renderer = createRenderer(document.body, world);
const input = createInput();
const loop = createFixedLoop((dt) => {
  stepWorld(world, dt);
  // Events live for one step; hand them to FX before the next step clears them.
  renderer.consumeEvents(world.events.events);
});

let last = performance.now();
function frame(now: number): void {
  input.poll(world.actions);
  world.camera.aspect = window.innerWidth / window.innerHeight || 1;
  loop.advance((now - last) / 1000);
  last = now;
  renderer.render(world);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
