/** Panel colors. `panel-style.test.ts` checks their contrast numerically, including the see-through panel. */
export const COLORS = {
  /** Opaque row track: light text sits on this. */
  track: '#10151f',
  /** Light text on the track. */
  text: '#f2f6ff',
  /** Opaque fill of the slider bar. */
  fill: '#4ee1ff',
  /** Dark text drawn inside the fill. */
  fillText: '#04060b',
  /** Panel body and tooltip background. */
  panel: '#0a0d14',
  /** Thin separators and borders. */
  line: '#273146',
  /** Marker for values that differ from their default (shown as an edge bar, not color alone). */
  changed: '#ffd24a',
  /** Outline of the hovered / active row. */
  outline: '#ffffff',
} as const;

/** The panel can be made see-through, but never below this opacity (keeps text readable over any game scene). */
export const MIN_PANEL_OPACITY = 0.7;
export const DEFAULT_PANEL_OPACITY = 0.85;

export const PANEL_WIDTH = 240;
export const ROW_HEIGHT = 24;
export const TOOLTIP_DELAY_MS = 300;
export const TOOLTIP_MAX_WIDTH = 260;

export const PANEL_CSS = `
#tuning-panel {
  --track: ${COLORS.track};
  --text: ${COLORS.text};
  --fill: ${COLORS.fill};
  --fill-text: ${COLORS.fillText};
  --line: ${COLORS.line};
  --changed: ${COLORS.changed};
  --outline: ${COLORS.outline};
  --panel-opacity: ${DEFAULT_PANEL_OPACITY};
  position: fixed; top: 8px; right: 8px; z-index: 20;
  width: ${PANEL_WIDTH}px; max-height: calc(100vh - 16px);
  overflow-y: auto; overflow-x: hidden;
  box-sizing: border-box;
  background: ${COLORS.panel};
  border: 1px solid var(--line);
  border-radius: 6px;
  font: 12px/1.2 ui-monospace, Menlo, Consolas, monospace;
  color: var(--text);
  opacity: var(--panel-opacity);
  -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px);
  scrollbar-width: thin;
}
#tuning-panel:hover, #tuning-panel.dragging { opacity: 1; }
#tuning-panel[hidden] { display: none; }
#tuning-panel * { box-sizing: border-box; }
#tuning-panel .header { padding: 6px 10px; display: flex; justify-content: space-between; align-items: baseline; font-weight: 700; border-bottom: 1px solid var(--line); }
#tuning-panel .header small { font-weight: 400; opacity: 0.8; }
#tuning-panel .section-title {
  display: block; width: 100%; height: ${ROW_HEIGHT}px; text-align: left; padding: 0 10px;
  background: #1a2232; color: var(--text); border: 0; border-bottom: 1px solid var(--line);
  font: inherit; font-weight: 700; cursor: pointer;
}
#tuning-panel .section-title:hover { outline: 1px solid var(--outline); outline-offset: -1px; }
#tuning-panel .section-body[hidden] { display: none; }
#tuning-panel .row {
  position: relative; height: ${ROW_HEIGHT}px; overflow: hidden;
  background: var(--track); border-bottom: 1px solid var(--line);
  user-select: none; -webkit-user-select: none; touch-action: none; outline: none;
}
#tuning-panel .row.slider { cursor: ew-resize; }
#tuning-panel .row.choice, #tuning-panel .row.button { cursor: pointer; }
#tuning-panel .row[hidden] { display: none; }
#tuning-panel .fill { position: absolute; left: 0; top: 0; bottom: 0; width: var(--p, 0%); background: var(--fill); }
#tuning-panel .txt {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: space-between;
  gap: 6px; padding: 0 8px 0 10px; white-space: nowrap; pointer-events: none;
}
#tuning-panel .txt .label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
#tuning-panel .txt .val { flex: none; text-align: right; font-variant-numeric: tabular-nums; }
#tuning-panel .txt .unit { opacity: 0.85; }
#tuning-panel .txt.light { color: var(--text); clip-path: inset(0 0 0 var(--p, 0%)); }
#tuning-panel .txt.dark { color: var(--fill-text); clip-path: inset(0 calc(100% - var(--p, 0%)) 0 0); }
#tuning-panel .row.choice .txt.light, #tuning-panel .row.button .txt.light { clip-path: none; }
#tuning-panel .row.choice .txt.dark, #tuning-panel .row.button .txt.dark { display: none; }
#tuning-panel .row.button .txt { justify-content: center; font-weight: 700; }
#tuning-panel .row:hover, #tuning-panel .row:focus-visible { outline: 1px solid var(--outline); outline-offset: -1px; }
#tuning-panel .row.active { outline: 2px solid var(--outline); outline-offset: -2px; }
#tuning-panel .row.active .val { font-weight: 700; text-decoration: underline; }
#tuning-panel .row[data-changed="true"]::before {
  content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--changed); z-index: 2;
}
#tuning-panel .row input.edit, #tuning-panel .row input.field {
  position: absolute; right: 4px; top: 2px; bottom: 2px; width: 96px; z-index: 3;
  background: #fff; color: #000; border: 1px solid #000; border-radius: 3px; padding: 0 6px;
  font: inherit; text-align: right;
}
#tuning-panel .row.status { height: auto; min-height: ${ROW_HEIGHT}px; cursor: default; }
#tuning-panel .row.status .msg { padding: 5px 10px; white-space: normal; word-break: break-word; }
.sf-tip {
  position: fixed; z-index: 30; display: none; max-width: ${TOOLTIP_MAX_WIDTH}px; box-sizing: border-box;
  padding: 8px 10px; background: ${COLORS.panel}; color: ${COLORS.text};
  border: 1px solid #4a5878; border-radius: 6px; pointer-events: none;
  font: 12px/1.4 ui-monospace, Menlo, Consolas, monospace; white-space: normal;
  box-shadow: 0 4px 16px rgba(0,0,0,0.5);
}
.sf-tip b { display: block; margin-bottom: 2px; }
.sf-tip small { display: block; margin-top: 4px; opacity: 0.85; }
`;
