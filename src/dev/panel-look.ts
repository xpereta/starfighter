import { screenFxSettings } from '../render/fx/screen-fx';
import {
  activeStyle,
  chosenStyleId,
  peekStyle,
  styleIds,
  touchStyle,
} from '../render/style-active';
import {
  EDITABLE_COLORS,
  fromCss,
  LOOK_SLIDERS,
  otherStyle,
  styleToJson,
  themeToTs,
  toCss,
} from './panel-look-logic';
import {
  blurActive,
  buttonRow,
  choiceRow,
  sliderRow,
  statusLine,
  type Row,
  type Section,
  type UiContext,
} from './panel-ui';

/** Keys of the Look section (the panel's own: H hides the panel, G the debug overlay). */
const PEEK_CODE = 'KeyV';
const SHOT_CODE = 'KeyK';
const SHOT_CLASS = 'sf-shot';
const SHOT_STYLE_ID = 'sf-look-style';

/** Hides the HUD, run HUD, debug overlay, panel and hint, so the same moment can be captured in two styles. */
const SHOT_CSS = `
body.${SHOT_CLASS} #hud, body.${SHOT_CLASS} #run-hud, body.${SHOT_CLASS} #debug-overlay,
body.${SHOT_CLASS} #tuning-panel, body.${SHOT_CLASS} .dev-hint, body.${SHOT_CLASS} .sf-tip { display: none !important; }
`;

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}

function setScreenshotMode(on: boolean): void {
  if (!document.getElementById(SHOT_STYLE_ID)) {
    const style = document.createElement('style');
    style.id = SHOT_STYLE_ID;
    style.textContent = SHOT_CSS;
    document.head.appendChild(style);
  }
  document.body.classList.toggle(SHOT_CLASS, on);
}

function download(name: string, text: string, type: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** A row with a colour input on the right. Same look as the other rows; the page keeps the keyboard. */
function colorRow(
  ctx: UiContext,
  o: {
    id: string;
    label: string;
    note: string;
    get: () => number;
    set: (v: number) => void;
    defaultValue: number;
  },
): Row {
  const row = document.createElement('div');
  row.className = 'row field';
  row.tabIndex = 0;
  row.dataset.param = o.id;
  row.setAttribute('aria-label', o.label);
  row.setAttribute('aria-description', o.note);
  const text = document.createElement('div');
  text.className = 'txt light';
  text.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span');
  label.className = 'label';
  label.textContent = o.label;
  text.append(label);
  const input = document.createElement('input');
  input.type = 'color';
  input.className = 'field';
  input.style.cssText = 'width:44px;padding:0 1px;height:18px;top:3px;bottom:auto;cursor:pointer;';
  input.setAttribute('aria-label', o.label);
  row.append(text, input);
  ctx.tip.attach(row, () => ({ title: o.label, note: o.note }));
  const changed = (): boolean => o.get() !== o.defaultValue;
  const refresh = (): void => {
    input.value = toCss(o.get());
    row.dataset.changed = String(changed());
  };
  input.addEventListener('input', () => {
    o.set(fromCss(input.value));
    touchStyle();
    refresh();
    ctx.changed();
  });
  input.addEventListener('change', () => blurActive());
  // Double-click the label to restore the pack's own colour, like every other row.
  text.addEventListener('dblclick', () => {
    o.set(o.defaultValue);
    touchStyle();
    refresh();
    ctx.changed();
  });
  refresh();
  return { el: row, refresh, isChanged: changed };
}

/**
 * Fills the Look section (below the Style picker): live editing of the active pack's main colours
 * and outline, Save style, hold-to-peek at another style, and the screenshot-friendly mode. Edits
 * change the in-memory pack only; nothing in `data/` is touched until you save and copy the file.
 */
export function addLookRows(
  ctx: UiContext,
  look: Section,
  track: <T extends Row>(row: T, into: Section) => T,
): () => void {
  const theme = activeStyle().theme;
  const start = { ...theme, palette: { ...theme.palette } };
  const say = statusLine();

  for (const c of EDITABLE_COLORS)
    track(
      colorRow(ctx, {
        id: `look.color.${c.key}`,
        label: c.label,
        note: `${c.note} Live edit of the active style; double-click the label to restore. Use Save style to keep it.`,
        get: () => activeStyle().theme.palette[c.key],
        set: (v) => (activeStyle().theme.palette[c.key] = v),
        defaultValue: start.palette[c.key],
      }),
      look,
    );
  track(
    colorRow(ctx, {
      id: 'look.color.outlineColor',
      label: 'Outline colour',
      note: 'Colour of the ink outline around ships. Double-click the label to restore.',
      get: () => activeStyle().theme.outlineColor,
      set: (v) => (activeStyle().theme.outlineColor = v),
      defaultValue: start.outlineColor,
    }),
    look,
  );
  track(
    colorRow(ctx, {
      id: 'look.color.eyeColor',
      label: 'Eye / cockpit',
      note: 'Colour of the sensor eyes and cockpits. Double-click the label to restore.',
      get: () => activeStyle().theme.eyeColor,
      set: (v) => (activeStyle().theme.eyeColor = v),
      defaultValue: start.eyeColor,
    }),
    look,
  );
  for (const s of LOOK_SLIDERS)
    track(
      sliderRow(ctx, {
        key: s.key,
        group: 'look',
        label: s.label,
        def: { ...s.def, default: start[s.key] },
        target: theme as unknown as Record<string, unknown>,
        onChange: () => touchStyle(),
      }),
      look,
    );
  track(
    choiceRow<boolean>(ctx, {
      id: 'look.screenFx',
      label: 'Screen effects',
      note: 'Flash frames, the short drawing-only freeze on big blasts, and speed lines. Off = none of them (the quality preset can also scale them).',
      options: () => [false, true],
      get: () => screenFxSettings.enabled,
      set: (v) => (screenFxSettings.enabled = v),
      defaultValue: true,
    }),
    look,
  );

  // Save style: the edited theme as a JSON file and as a ready-to-drop theme.ts.
  look.add(
    buttonRow(
      ctx,
      'Save style (JSON)',
      () => {
        const id = activeStyle().manifest.id;
        download(`${id}-theme.json`, styleToJson(activeStyle()), 'application/json');
        say.set(`saved ${id}-theme.json`);
      },
      'Downloads the edited theme (colours, outline, shadow, glow) of the active style as a JSON file.',
    ),
  );
  look.add(
    buttonRow(
      ctx,
      'Save theme.ts',
      () => {
        const id = activeStyle().manifest.id;
        download('theme.ts', themeToTs(activeStyle().theme), 'text/plain');
        say.set(`saved theme.ts: drop it into data/styles/${id}/ and open a PR on style/${id}`);
      },
      'Downloads the edited theme as a theme.ts file to drop into data/styles/<id>/, replacing the old one.',
    ),
  );

  // Compare: hold a key to peek at another style, and a screenshot-friendly mode.
  const peek = { id: otherStyle(styleIds(), chosenStyleId()) };
  track(
    choiceRow<string>(ctx, {
      id: 'look.peekStyle',
      label: `Peek style (hold V)`,
      note: 'Hold V to see the game in this other style while the key is down, then it flips back. Handy to compare two directions on the same moment.',
      options: styleIds,
      get: () => peek.id,
      set: (id) => (peek.id = id),
      format: (id) => id,
      trackChange: false,
    }),
    look,
  );
  const shot = { on: false };
  const shotRow = track(
    choiceRow<boolean>(ctx, {
      id: 'look.screenshot',
      label: 'Screenshot mode (K)',
      note: 'Hides the HUD, the dev overlays and this panel so you can capture the picture. Press K again to bring them back.',
      options: () => [false, true],
      get: () => shot.on,
      set: (v) => {
        shot.on = v;
        setScreenshotMode(v);
      },
      trackChange: false,
    }),
    look,
  );
  look.add(say);

  const onKeyDown = (e: KeyboardEvent): void => {
    if (isTyping(e.target) || e.repeat) return;
    if (e.code === PEEK_CODE) peekStyle(peek.id);
    else if (e.code === SHOT_CODE) {
      shot.on = !shot.on;
      setScreenshotMode(shot.on);
      shotRow.refresh();
    }
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    if (e.code === PEEK_CODE) peekStyle(null);
  };
  const onBlur = (): void => peekStyle(null);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    peekStyle(null);
    setScreenshotMode(false);
  };
}
