import { createRenderer } from '../render/renderer';
import { createWorld, stepWorld } from '../core/world/world';
import { createFixedLoop } from './loop';

const renderer = createRenderer(document.body);
const world = createWorld(Date.now() >>> 0);
const loop = createFixedLoop((dt) => stepWorld(world, dt));

let last = performance.now();
function frame(now: number): void {
  loop.advance((now - last) / 1000);
  last = now;
  renderer.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
