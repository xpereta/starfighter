import type { PortraitPalette, UiColors } from './presentation';
import { portraitSpec, portraitSvg } from './portrait';

/** Small DOM helpers shared by the spectacle HUD and menus. */

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Sets the text only when it changed (the DOM is not touched on a quiet frame). */
export function setText(e: HTMLElement, text: string): void {
  if (e.textContent !== text) e.textContent = text;
}

export function setClass(e: HTMLElement, name: string, on: boolean): void {
  if (e.classList.contains(name) !== on) e.classList.toggle(name, on);
}

export function setHidden(e: HTMLElement, hidden: boolean): void {
  if (e.hidden !== hidden) e.hidden = hidden;
}

/** Sets a style property only when it changed. */
export function setStyle(e: HTMLElement, prop: string, value: string): void {
  if (e.style.getPropertyValue(prop) !== value) e.style.setProperty(prop, value);
}

/** Puts the style's colours on a root element as CSS variables. */
export function applyColors(root: HTMLElement, c: UiColors): void {
  root.style.setProperty('--accent', c.accent);
  root.style.setProperty('--hot', c.hot);
  root.style.setProperty('--gold', c.gold);
  root.style.setProperty('--mint', c.mint);
  root.style.setProperty('--ink', c.ink);
  root.style.setProperty('--panel', c.panel);
  root.style.setProperty('--text', c.text);
  root.style.setProperty('--dim', c.dim);
}

/** Portraits are generated once per pilot name and cached (the same name always gives the same picture). */
export function createPortraits(palette: PortraitPalette): (name: string) => HTMLElement {
  const cache = new Map<string, string>();
  return (name) => {
    let svg = cache.get(name);
    if (svg === undefined) {
      svg = portraitSvg(portraitSpec(name, palette));
      cache.set(name, svg);
    }
    const box = el('span', 'sx-portrait');
    box.innerHTML = svg; // our own generated markup: fixed shapes and colour numbers, no pilot text in it
    return box;
  };
}

/** Pips as small elements: `on`/`off` classes. */
export function pipRow(
  className: string,
  pipClass: string,
  states: readonly string[],
): HTMLElement {
  const row = el('span', className);
  for (const s of states) row.append(el('i', `${pipClass} ${s}`));
  return row;
}
