import type { World } from '../core/world/world';

/**
 * The PAUSED overlay: a DOM element over the frozen frame. Display only, CSS-sized. `data-tick`
 * mirrors the world tick so tests can see that nothing advanced.
 */
export const PAUSE_CSS = `
#pause-overlay {
  position: fixed; inset: 0; z-index: 20; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 8px; padding: 16px; text-align: center; background: rgba(2, 3, 8, 0.55);
  font: 16px/1.4 ui-monospace, Menlo, Consolas, monospace; color: #f2f6ff; pointer-events: none;
}
#pause-overlay[hidden] { display: none; }
#pause-overlay h1 { margin: 0; font-size: 36px; letter-spacing: 0.2em; }
#pause-overlay p { margin: 0; color: #aab4c8; overflow-wrap: anywhere; }
`;

export const PAUSE_HINT = 'Press P or Esc (Start on a gamepad) to resume.';

export interface PauseView {
  draw(world: World, paused: boolean): void;
  dispose(): void;
}

export function createPauseView(container: HTMLElement): PauseView {
  const style = document.createElement('style');
  style.textContent = PAUSE_CSS;
  const root = document.createElement('div');
  root.id = 'pause-overlay';
  root.hidden = true;
  root.setAttribute('role', 'status');
  const title = document.createElement('h1');
  title.textContent = 'PAUSED';
  const hint = document.createElement('p');
  hint.textContent = PAUSE_HINT;
  root.append(title, hint);
  container.append(style, root);
  return {
    draw(world, paused) {
      root.hidden = !paused;
      root.dataset.tick = String(world.tick);
    },
    dispose() {
      root.remove();
      style.remove();
    },
  };
}
