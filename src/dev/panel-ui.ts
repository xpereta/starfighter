import type { ParamDef } from '../core/params/params';
import {
  clampToRelations,
  formatValue,
  fractionOf,
  isChanged,
  labelOf,
  roundTyped,
  snapToStep,
  valueAtFraction,
} from './panel-logic';
import { PANEL_CSS, TOOLTIP_DELAY_MS } from './panel-style';

/** Small DOM toolkit for the tuning panel: one-line rows, sections, a hover tooltip. No libraries. */

const DRAG_THRESHOLD_PX = 3;
const FINE_DIVISOR = 10; // shift-drag moves the value this much slower

export interface Row {
  readonly el: HTMLElement;
  /** Re-reads the bound value and redraws the row. */
  refresh(): void;
  isChanged(): boolean;
}

export interface Tooltip {
  attach(el: HTMLElement, content: () => { title: string; note: string; extra?: string }): void;
  hide(): void;
  dispose(): void;
}

export interface UiContext {
  readonly root: HTMLElement;
  readonly tip: Tooltip;
  /** Called after any value changed (so the panel can update the "only changed" filter). */
  changed(): void;
}

/** Drops keyboard focus so game keys (arrows, WASD, Space, Shift) keep going to the game. */
export function blurActive(): void {
  const el = document.activeElement;
  if (el instanceof HTMLElement && el !== document.body) el.blur();
}

function injectStyle(): void {
  if (document.getElementById('sf-panel-style')) return;
  const style = document.createElement('style');
  style.id = 'sf-panel-style';
  style.textContent = PANEL_CSS;
  document.head.appendChild(style);
}

export function createPanelRoot(): HTMLElement {
  injectStyle();
  const root = document.createElement('div');
  root.id = 'tuning-panel';
  document.body.appendChild(root);
  return root;
}

// Tooltip --------------------------------------------------------------------------------

/** One shared tooltip: appears after a short delay, wraps, and flips to whichever side of the panel has room. */
export function createTooltip(root: HTMLElement): Tooltip {
  const tip = document.createElement('div');
  tip.className = 'sf-tip';
  tip.setAttribute('role', 'tooltip');
  document.body.appendChild(tip);
  let timer = 0;
  const cleanups: (() => void)[] = [];

  function hide(): void {
    window.clearTimeout(timer);
    tip.style.display = 'none';
  }

  function show(el: HTMLElement, c: { title: string; note: string; extra?: string }): void {
    tip.replaceChildren();
    const title = document.createElement('b');
    title.textContent = c.title;
    const note = document.createElement('div');
    note.textContent = c.note;
    tip.append(title, note);
    if (c.extra) {
      const extra = document.createElement('small');
      extra.textContent = c.extra;
      tip.append(extra);
    }
    tip.style.visibility = 'hidden';
    tip.style.display = 'block';
    const margin = 8;
    const panel = root.getBoundingClientRect();
    const row = el.getBoundingClientRect();
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    // Prefer the left of the panel (it sits on the right edge); flip right if there is no room.
    let x = panel.left - margin - w;
    if (x < margin) x = panel.right + margin;
    if (x + w > window.innerWidth - margin) x = Math.max(margin, window.innerWidth - margin - w);
    const y = Math.min(
      Math.max(row.top, margin),
      Math.max(margin, window.innerHeight - margin - h),
    );
    tip.style.left = `${Math.round(x)}px`;
    tip.style.top = `${Math.round(y)}px`;
    tip.style.visibility = 'visible';
  }

  return {
    attach(el, content) {
      const schedule = (): void => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => show(el, content()), TOOLTIP_DELAY_MS);
      };
      const onFocus = (): void => {
        if (el.matches(':focus-visible')) schedule(); // keyboard focus only, not mouse clicks
      };
      el.addEventListener('mouseenter', schedule);
      el.addEventListener('mouseleave', hide);
      el.addEventListener('focus', onFocus);
      el.addEventListener('blur', hide);
      el.addEventListener('pointerdown', hide);
      cleanups.push(() => {
        el.removeEventListener('mouseenter', schedule);
        el.removeEventListener('mouseleave', hide);
        el.removeEventListener('focus', onFocus);
        el.removeEventListener('blur', hide);
        el.removeEventListener('pointerdown', hide);
      });
    },
    hide,
    dispose() {
      hide();
      cleanups.forEach((fn) => fn());
      tip.remove();
    },
  };
}

// Rows ---------------------------------------------------------------------------------------

function textLayer(kind: 'light' | 'dark'): {
  el: HTMLElement;
  label: HTMLElement;
  num: HTMLElement;
  unit: HTMLElement;
} {
  const el = document.createElement('div');
  el.className = `txt ${kind}`;
  el.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span');
  label.className = 'label';
  const val = document.createElement('span');
  val.className = 'val';
  const num = document.createElement('span');
  const unit = document.createElement('span');
  unit.className = 'unit';
  val.append(num, unit);
  el.append(label, val);
  return { el, label, num, unit };
}

/** '2.0 s' (number rounded like the row shows it, then the short unit). */
function withUnit(value: number, def: ParamDef): string {
  const t = formatValue(value, def);
  return t.unit ? `${t.number} ${t.unit}` : t.number;
}

function makeRow(kind: string): HTMLElement {
  const row = document.createElement('div');
  row.className = `row ${kind}`;
  row.tabIndex = 0;
  return row;
}

function describe(row: HTMLElement, label: string, note: string): void {
  row.setAttribute('aria-label', label);
  row.setAttribute('aria-description', note);
}

export interface SliderOptions {
  /** Key inside `target`, and the group it belongs to (for cross-field relations). */
  key: string;
  group: string;
  def: ParamDef;
  target: Record<string, unknown>;
  label?: string;
  /** Show the changed-from-default marker (default true). */
  trackChange?: boolean;
  onChange?: (value: number) => void;
}

/** Slider row: the bar is a fill inside the row; the text is drawn twice, light on the track and dark inside the fill. */
export function sliderRow(ctx: UiContext, o: SliderOptions): Row {
  const label = o.label ?? labelOf(o.key);
  const row = makeRow('slider');
  row.dataset.param = `${o.group}.${o.key}`;
  const fill = document.createElement('div');
  fill.className = 'fill';
  const light = textLayer('light');
  const dark = textLayer('dark');
  row.append(fill, light.el, dark.el);
  for (const layer of [light, dark]) layer.label.textContent = label;

  const get = (): number => o.target[o.key] as number;
  const note = o.def.note ?? '';
  row.setAttribute('role', 'slider');
  row.setAttribute('aria-valuemin', String(o.def.min));
  row.setAttribute('aria-valuemax', String(o.def.max));
  describe(row, label, note);
  ctx.tip.attach(row, () => ({
    title: label,
    note,
    extra: `Default ${withUnit(o.def.default, o.def)} · range ${o.def.min}–${withUnit(o.def.max, o.def)}`,
  }));

  const changed = (): boolean => o.trackChange !== false && isChanged(get(), o.def.default);
  function refresh(): void {
    const v = get();
    const text = formatValue(v, o.def);
    for (const layer of [light, dark]) {
      layer.num.textContent = text.number;
      layer.unit.textContent = text.unit ? ` ${text.unit}` : '';
    }
    row.style.setProperty('--p', `${(fractionOf(v, o.def) * 100).toFixed(2)}%`);
    row.dataset.changed = String(changed());
    row.setAttribute('aria-valuenow', String(v));
    row.setAttribute('aria-valuetext', `${text.number} ${text.unit}`.trim());
  }

  /** Applies an edited value: relations first (the edited value moves, not its partner), then range. */
  function set(raw: number): void {
    const related = clampToRelations(o.group, o.key, raw, o.target);
    const value = Math.min(o.def.max, Math.max(o.def.min, related));
    if (value === get()) return;
    o.target[o.key] = value;
    refresh();
    o.onChange?.(value);
    ctx.changed();
  }

  // Drag: nothing happens until the pointer moves a few pixels, so double-clicks never change the value.
  let drag: {
    pointerId: number;
    startX: number;
    moved: boolean;
    anchorX: number;
    anchorValue: number;
    fine: boolean;
  } | null = null;
  row.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('input')) return;
    drag = {
      pointerId: e.pointerId,
      startX: e.clientX,
      moved: false,
      anchorX: e.clientX,
      anchorValue: get(),
      fine: false,
    };
    row.setPointerCapture(e.pointerId);
  });
  row.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (!drag.moved) {
      if (Math.abs(e.clientX - drag.startX) < DRAG_THRESHOLD_PX) return;
      drag.moved = true;
      row.classList.add('active');
      ctx.root.classList.add('dragging');
      ctx.tip.hide();
    }
    const rect = row.getBoundingClientRect();
    if (e.shiftKey !== drag.fine) {
      // Switching between normal and fine mode re-anchors, so the value never jumps.
      drag.fine = e.shiftKey;
      drag.anchorX = e.clientX;
      drag.anchorValue = get();
    }
    if (drag.fine) {
      const span = o.def.max - o.def.min;
      const delta = ((e.clientX - drag.anchorX) / rect.width) * span;
      set(snapToStep(drag.anchorValue + delta / FINE_DIVISOR, o.def));
    } else {
      set(valueAtFraction((e.clientX - rect.left) / rect.width, o.def));
    }
  });
  const endDrag = (e: PointerEvent): void => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    drag = null;
    row.classList.remove('active');
    ctx.root.classList.remove('dragging');
    if (row.hasPointerCapture(e.pointerId)) row.releasePointerCapture(e.pointerId);
    blurActive(); // so arrows / Space keep flying the ship
  };
  row.addEventListener('pointerup', endDrag);
  row.addEventListener('pointercancel', endDrag);

  // Double-click the label: reset to default. Double-click the value: type it.
  row.addEventListener('dblclick', (e) => {
    const target = e.target as HTMLElement | null;
    const rect = row.getBoundingClientRect();
    const onValue = e.clientX > rect.right - 90;
    if (target?.closest('input')) return;
    if (!onValue) {
      set(o.def.default);
      blurActive();
      return;
    }
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'edit';
    input.inputMode = 'decimal';
    input.setAttribute('aria-label', `${label} value`);
    input.value = formatValue(get(), o.def).number;
    row.classList.add('active');
    row.appendChild(input);
    input.focus();
    input.select();
    let done = false;
    const finish = (commit: boolean): void => {
      if (done) return;
      done = true;
      const parsed = Number.parseFloat(input.value.replace(',', '.'));
      if (commit && Number.isFinite(parsed)) set(roundTyped(parsed, o.def));
      input.remove();
      row.classList.remove('active');
      blurActive();
    };
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') finish(true);
      else if (ev.key === 'Escape') finish(false);
      ev.stopPropagation();
    });
    input.addEventListener('blur', () => finish(true));
  });

  refresh();
  return { el: row, refresh, isChanged: changed };
}

export interface ChoiceOptions<T> {
  /** Unique id (also the data-param attribute). */
  id: string;
  label: string;
  note: string;
  options: () => readonly T[];
  get: () => T;
  set: (value: T) => void;
  format?: (value: T) => string;
  defaultValue?: T;
  /** Show the changed-from-default marker (default: when `defaultValue` is given). */
  trackChange?: boolean;
}

/** Row that cycles through options on click: booleans show a filled/empty marker, so state is not color alone. */
export function choiceRow<T>(ctx: UiContext, o: ChoiceOptions<T>): Row {
  const row = makeRow('choice');
  row.dataset.param = o.id;
  const light = textLayer('light');
  row.append(light.el);
  light.label.textContent = o.label;
  const format =
    o.format ?? ((v: T): string => (typeof v === 'boolean' ? (v ? '● on' : '○ off') : String(v)));
  const tracked = o.trackChange ?? o.defaultValue !== undefined;
  const changed = (): boolean => tracked && isChanged(o.get(), o.defaultValue);

  describe(row, o.label, o.note);
  ctx.tip.attach(row, () => ({
    title: o.label,
    note: o.note,
    extra: o.defaultValue === undefined ? undefined : `Default ${format(o.defaultValue)}`,
  }));

  function refresh(): void {
    light.num.textContent = format(o.get());
    row.dataset.changed = String(changed());
    row.setAttribute('aria-label', `${o.label}: ${format(o.get())}`);
  }
  function cycle(): void {
    const options = o.options();
    if (options.length === 0) return;
    const next = options[(options.indexOf(o.get()) + 1) % options.length]!;
    o.set(next);
    refresh();
    ctx.changed();
  }
  row.addEventListener('click', () => {
    cycle();
    blurActive();
  });
  row.addEventListener('dblclick', (e) => {
    // Double-click on the label resets to the default.
    if (o.defaultValue === undefined) return;
    const rect = row.getBoundingClientRect();
    if (e.clientX > rect.left + rect.width / 2) return;
    o.set(o.defaultValue);
    refresh();
    ctx.changed();
  });
  refresh();
  return { el: row, refresh, isChanged: changed };
}

/** Full-width action button row. */
export function buttonRow(ctx: UiContext, label: string, run: () => void, note = ''): Row {
  const row = makeRow('button');
  const light = textLayer('light');
  row.append(light.el);
  light.label.textContent = label;
  light.el.querySelector('.val')?.remove();
  row.setAttribute('role', 'button');
  describe(row, label, note);
  if (note) ctx.tip.attach(row, () => ({ title: label, note }));
  row.addEventListener('click', () => {
    run();
    blurActive();
  });
  row.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') run();
  });
  row.dataset.changed = 'false';
  return { el: row, refresh: () => undefined, isChanged: () => false };
}

/** Row with a text field (preset name). Real typing: the game ignores keys while it has focus. */
export function fieldRow(
  ctx: UiContext,
  label: string,
  state: { value: string },
  note: string,
): Row {
  const row = makeRow('field');
  const light = textLayer('light');
  light.el.querySelector('.val')?.remove();
  light.label.textContent = label;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'field';
  input.value = state.value;
  input.setAttribute('aria-label', label);
  input.addEventListener('input', () => (state.value = input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') blurActive();
    e.stopPropagation();
  });
  row.append(light.el, input);
  describe(row, label, note);
  ctx.tip.attach(row, () => ({ title: label, note }));
  row.dataset.changed = 'false';
  return { el: row, refresh: () => (input.value = state.value), isChanged: () => false };
}

export interface StatusLine {
  readonly el: HTMLElement;
  set(text: string): void;
}

/** Wrapping text line for messages. */
export function statusLine(): StatusLine {
  const row = document.createElement('div');
  row.className = 'row status';
  row.setAttribute('role', 'status');
  row.dataset.status = '';
  const msg = document.createElement('div');
  msg.className = 'msg';
  row.append(msg);
  return {
    el: row,
    set(text) {
      msg.textContent = text;
      row.dataset.status = text;
    },
  };
}

// Sections -----------------------------------------------------------------------------------

export interface Section {
  readonly el: HTMLElement;
  readonly body: HTMLElement;
  add(row: Row | StatusLine): void;
  /** Rows of this section that are parameters (hidden by "show only changed"). */
  readonly rows: Row[];
  setHidden(hidden: boolean): void;
}

export function section(title: string, open: boolean): Section {
  const el = document.createElement('section');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'section-title';
  const body = document.createElement('div');
  body.className = 'section-body';
  const rows: Row[] = [];
  const render = (isOpen: boolean): void => {
    button.textContent = `${isOpen ? '▾' : '▸'} ${title}`;
    button.setAttribute('aria-expanded', String(isOpen));
    body.hidden = !isOpen;
  };
  let isOpen = open;
  button.addEventListener('click', () => {
    isOpen = !isOpen;
    render(isOpen);
    blurActive();
  });
  render(isOpen);
  el.append(button, body);
  return {
    el,
    body,
    rows,
    add(row) {
      body.append(row.el);
      if ('refresh' in row) rows.push(row);
    },
    setHidden(hidden) {
      el.hidden = hidden;
    },
  };
}
