/**
 * Where the debug overlay puts its text readout and the turn-rate chart: a column at the top-left,
 * under the game's own HUD text, so nothing sits over the middle of the screen where the action is.
 * Pure, so a test can check it never reaches the centre.
 */

const LEFT = 24; // px, same margin as the HUD
/** First readout baseline: under the HUD's kills / wingmen / order lines (which end around y = 80). */
const TOP = 110;
const LINE_HEIGHT = 16;
const CHART_GAP = 36; // room for the chart's label line above it

export interface ReadoutLayout {
  /** Left edge of the text. */
  textX: number;
  /** Baseline of line `i` of the text. */
  lineY: (i: number) => number;
  /** Top of the backing box behind the text, and its height. */
  boxY: number;
  boxHeight: number;
  /** Top-left of the chart's plotting area. */
  chartX: number;
  chartY: number;
  /** Lowest pixel used by the whole column. */
  bottom: number;
}

export function readoutLayout(lineCount: number, chartHeight: number): ReadoutLayout {
  const textBottom = TOP + (lineCount - 1) * LINE_HEIGHT;
  const chartY = textBottom + CHART_GAP;
  return {
    textX: LEFT,
    lineY: (i) => TOP + i * LINE_HEIGHT,
    boxY: TOP - 14,
    boxHeight: lineCount * LINE_HEIGHT + 8,
    chartX: LEFT + 6,
    chartY,
    bottom: chartY + chartHeight + 6,
  };
}
