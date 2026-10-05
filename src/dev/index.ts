import type { World } from '../core/world/world';
import { createDebugOverlay } from './debug-overlay';
import { createPanel } from './panel';

export interface DevTools {
  /** Call once per frame with the wall-clock frame time. */
  /** Call before every simulation step (records or injects replay inputs). */
  beforeStep(world: World): void;
  draw(world: World, frameSeconds: number): void;
  dispose(): void;
}

/** Seconds between two updates of the Sound section's loop readout (s). */
const READOUT_INTERVAL = 0.1;

/** Tuning panel + debug overlay. Loaded lazily (see app/main.ts), never part of the gameplay bundle. */
export function createDevTools(world: World, container: HTMLElement): DevTools {
  const panel = createPanel(world);
  const overlay = createDebugOverlay(container);
  let sinceReadout = 0;
  return {
    beforeStep: (w) => panel.replay.beforeStep(w),
    draw: (w, frameSeconds) => {
      overlay.draw(w, frameSeconds, panel.debug.overlay);
      sinceReadout += frameSeconds;
      if (sinceReadout >= READOUT_INTERVAL) {
        sinceReadout = 0;
        panel.soundReadout.update(w);
      }
    },
    dispose() {
      panel.dispose();
      overlay.dispose();
    },
  };
}
