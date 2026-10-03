import type { World } from '../core/world/world';
import { createDebugOverlay } from './debug-overlay';
import { createPanel } from './panel';

export interface DevTools {
  /** Call once per frame with the wall-clock frame time. */
  draw(world: World, frameSeconds: number): void;
  dispose(): void;
}

/** Tuning panel + debug overlay. Loaded lazily (see app/main.ts), never part of the gameplay bundle. */
export function createDevTools(world: World, container: HTMLElement): DevTools {
  const panel = createPanel(world);
  const overlay = createDebugOverlay(container);
  return {
    draw: (w, frameSeconds) => overlay.draw(w, frameSeconds, panel.debug.overlay),
    dispose() {
      panel.dispose();
      overlay.dispose();
    },
  };
}
