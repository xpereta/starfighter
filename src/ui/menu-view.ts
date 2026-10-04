import type { World } from '../core/world/world';
import {
  buildScreen,
  menuDataFromWorld,
  menuVisible,
  type MenuExtras,
  type MenuScreen,
} from './menu-model';

/**
 * Draws the run menus as a DOM overlay. Display only: it never changes the world, the game moves
 * through the `menu*` actions. Everything is CSS-sized (no pixel sizes from the canvas), so text
 * wraps instead of clipping at any window size or pixel ratio.
 */

const COLORS = {
  panel: 'rgba(8, 11, 20, 0.92)',
  line: '#273146',
  text: '#f2f6ff',
  dim: '#aab4c8',
  accent: '#4ee1ff',
  accentText: '#04060b',
};

export const MENU_CSS = `
#run-menu {
  position: fixed; inset: 0; z-index: 10; display: flex; align-items: center; justify-content: center;
  padding: 16px; box-sizing: border-box; background: rgba(2, 3, 8, 0.55);
  font: 16px/1.4 ui-monospace, Menlo, Consolas, monospace; color: ${COLORS.text};
}
#run-menu[hidden] { display: none; }
#run-menu * { box-sizing: border-box; }
#run-menu .card {
  width: min(560px, 100%); max-height: 100%; overflow-y: auto;
  background: ${COLORS.panel}; border: 1px solid ${COLORS.line}; border-radius: 8px; padding: 24px 28px;
}
#run-menu h1 { margin: 0 0 12px; font-size: 28px; letter-spacing: 0.12em; }
#run-menu p { margin: 0 0 6px; color: ${COLORS.dim}; overflow-wrap: anywhere; }
#run-menu ul { list-style: none; margin: 16px 0 0; padding: 0; display: grid; gap: 8px; }
#run-menu li {
  display: grid; grid-template-columns: 5ch 1fr; gap: 0 8px; padding: 8px 12px;
  border: 1px solid ${COLORS.line}; border-radius: 6px; overflow-wrap: anywhere;
}
#run-menu li .mark { font-weight: 700; white-space: pre; }
#run-menu li .detail { grid-column: 2; color: ${COLORS.dim}; font-size: 14px; }
#run-menu li.current { background: ${COLORS.accent}; color: ${COLORS.accentText}; border-color: ${COLORS.accent}; }
#run-menu li.current .detail { color: ${COLORS.accentText}; }
#run-menu .hint { margin-top: 16px; font-size: 13px; color: ${COLORS.dim}; }
`;

/** Marker column: the highlight arrow, plus the tick box state for toggles (shape, not colour alone). */
function markOf(screen: MenuScreen, index: number): string {
  const item = screen.items[index]!;
  const box = item.checked === undefined ? '' : item.checked ? '[x]' : '[ ]';
  return `${index === screen.cursor ? '>' : ''}${box}`;
}

/** A string that changes exactly when the picture would, so the DOM is rebuilt only then. */
export function screenKey(screen: MenuScreen | null): string {
  return screen === null ? '' : JSON.stringify(screen);
}

export interface MenuView {
  draw(world: World): void;
  dispose(): void;
}

export function createMenuView(container: HTMLElement, getExtras: () => MenuExtras): MenuView {
  const style = document.createElement('style');
  style.textContent = MENU_CSS;
  const root = document.createElement('div');
  root.id = 'run-menu';
  root.hidden = true;
  container.append(style, root);
  let shown = '';

  function render(screen: MenuScreen): void {
    root.replaceChildren();
    const card = document.createElement('div');
    card.className = 'card';
    const title = document.createElement('h1');
    title.textContent = screen.title;
    card.append(title);
    for (const line of screen.lines) {
      const p = document.createElement('p');
      p.textContent = line;
      card.append(p);
    }
    const list = document.createElement('ul');
    screen.items.forEach((item, i) => {
      const li = document.createElement('li');
      if (i === screen.cursor) li.className = 'current';
      const mark = document.createElement('span');
      mark.className = 'mark';
      mark.textContent = markOf(screen, i);
      const label = document.createElement('span');
      label.textContent = item.label;
      li.append(mark, label);
      if (item.detail) {
        const detail = document.createElement('span');
        detail.className = 'detail';
        detail.textContent = item.detail;
        li.append(detail);
      }
      list.append(li);
    });
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = 'D-pad, stick or W/S: move. A, Enter or Space: choose. B or Esc: back.';
    card.append(list, hint);
    root.append(card);
  }

  return {
    draw(world) {
      const screen = menuVisible(world.run)
        ? buildScreen(menuDataFromWorld(world, getExtras()))
        : null;
      const key = screenKey(screen);
      if (key === shown) return;
      shown = key;
      root.hidden = screen === null;
      if (screen !== null) render(screen);
    },
    dispose() {
      root.remove();
      style.remove();
    },
  };
}
