import { createRenderer } from '../render/renderer';
import { createFixedLoop } from './loop';

const renderer = createRenderer(document.body);
const loop = createFixedLoop(() => {
  // Simulation step: gameplay modules plug in here (Prototype 1 issues).
});

let last = performance.now();
function frame(now: number): void {
  loop.advance((now - last) / 1000);
  last = now;
  renderer.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
