import { applyColors, createPortraits, el, setClass } from './dom';
import type { MenuLayout, SquadCard } from './menu-layout';
import { structureKey } from './menu-layout';
import type { PresentationDef } from './presentation';

/**
 * The cinematic Start screen, debrief and end screen: an animated backdrop (drifting stars, light
 * beams, a slow halo) that stays up across screens, and a stage that is rebuilt (with a diagonal
 * wipe and slide-in animation) whenever the screen changes. A cursor move only moves the highlight.
 * Display only: the game changes through the `menu*` actions, like the classic menus.
 */

export interface SpectacleMenu {
  readonly root: HTMLElement;
  /** `null` hides the menu (a battle is on). */
  draw(layout: MenuLayout | null): void;
  dispose(): void;
}

export function createSpectacleMenu(container: HTMLElement, def: PresentationDef): SpectacleMenu {
  const root = el('div', 'sx-root');
  root.id = 'sx-menu';
  root.hidden = true;
  applyColors(root, def.colors);
  const portrait = createPortraits(def.portraits);

  const backdrop = el('div', 'backdrop');
  backdrop.style.cssText = 'position:absolute;inset:0';
  backdrop.append(
    el('div', 'bg'),
    el('div', 'stars a'),
    el('div', 'stars b'),
    el('div', 'halo'),
    el('div', 'beam'),
    el('div', 'beam two'),
    el('div', 'vignette'),
  );
  root.append(backdrop);
  container.append(root);

  let key = '';
  let stage: HTMLElement | null = null;
  let wipe: HTMLElement | null = null;
  let itemEls: HTMLElement[] = [];
  let shownCursor = -1;

  function squadCard(c: SquadCard): HTMLElement {
    const card = el('div', `sx-card${c.fallen ? ' fallen' : ''}`);
    card.append(portrait(c.name));
    const info = el('div');
    info.append(el('div', 'who', c.first), el('div', 'cs', (c.callsign || c.trait).toUpperCase()));
    if (c.fallen) info.append(el('div', 'lost', 'LOST'));
    else info.append(el('div', 'cs', c.trait.toUpperCase()));
    card.append(info);
    return card;
  }

  function build(layout: MenuLayout): void {
    stage?.remove();
    wipe?.remove();
    root.className = `sx-root tone-${layout.tone}`;
    const s = el('div', 'stage');
    const head = el('div', 'head');
    head.append(
      el('div', 'kicker', layout.kicker),
      el('h1', 'title', layout.title),
      el('div', 'slash'),
    );
    const notes = el('div', 'notes');
    for (const line of layout.notes) notes.append(el('p', '', line));
    head.append(notes);

    const mid = el('div', 'mid');
    const stats = el('div', 'stats');
    for (const st of layout.stats) {
      const stat = el('div', 'stat sx-glow gold');
      stat.append(el('div', 'sx-label', st.label), el('div', 'v sx-num', st.value));
      stats.append(stat);
    }
    mid.append(stats);
    if (layout.squad.length > 0) {
      const squad = el('div', 'squad');
      for (const c of layout.squad) squad.append(squadCard(c));
      mid.append(squad);
    }

    const bottom = el('div', 'bottom');
    const items = el('div', 'items');
    itemEls = layout.items.map((item, i) => {
      const row = el('div', `sx-item${item.portrait ? ' has-portrait' : ''}`);
      row.style.setProperty('--i', String(i));
      row.append(el('span', 'mark'));
      if (item.portrait) row.append(portrait(item.portrait));
      else row.append(el('span'));
      const body = el('span');
      body.append(el('span', 'lbl', item.label));
      if (item.checked !== undefined) {
        body.append(
          el('span', 'ticked', item.checked ? '  [x] ON THE ROSTER' : '  [ ] STAYS HOME'),
        );
      }
      if (item.detail) body.append(el('span', 'det', item.detail));
      row.append(body);
      items.append(row);
      return row;
    });
    bottom.append(items, el('div', 'foot', layout.hint));

    s.append(head, mid, bottom);
    stage = s;
    wipe = el('div', 'wipe');
    root.append(s, wipe);
    shownCursor = -1;
  }

  function moveCursor(cursor: number): void {
    if (cursor === shownCursor) return;
    shownCursor = cursor;
    itemEls.forEach((row, i) => {
      setClass(row, 'current', i === cursor);
      const mark = row.firstElementChild as HTMLElement;
      mark.textContent = i === cursor ? '▶' : '';
    });
  }

  return {
    root,
    draw(layout) {
      if (layout === null) {
        if (!root.hidden) root.hidden = true;
        key = '';
        return;
      }
      if (root.hidden) root.hidden = false;
      const k = structureKey(layout);
      if (k !== key) {
        key = k;
        build(layout);
      }
      moveCursor(layout.cursor);
    },
    dispose() {
      root.remove();
    },
  };
}
