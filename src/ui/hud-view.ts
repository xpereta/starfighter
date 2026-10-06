import type { World } from '../core/world/world';
import { PAD } from '../render/hud/hud';
import {
  clearChatter,
  createChatter,
  feedChatter,
  lineAlpha,
  stepChatter,
  type ChatterLine,
} from './chatter';
import { cueText } from './cues';
import { menuVisible } from './menu-model';
import { objectiveText, rosterRows, type RosterRow } from './roster';

/**
 * The run HUD that is text: the squad roster (top-left, under the canvas HUD lines), the objective
 * line (top-centre) and the radio chatter feed (bottom-centre). A DOM overlay, CSS-sized, display only.
 * Shown in run mode during a battle; practice mode never shows it.
 */

/**
 * The canvas HUD's top-left lines have baselines at PAD+10, PAD+30 and PAD+50 (an order or cue), and
 * the centre warning "RETURN TO ARENA" sits at PAD+50 too. The roster starts below the last of them, and
 * the objective sits between the first line and that warning (a 14px font is about 18px tall).
 */
export const ROSTER_TOP = PAD + 58;
export const OBJECTIVE_TOP = PAD + 16;
/** Enemy cues (WING INBOUND) sit under the centre warning line and the MISSILE warning text (baseline PAD + 86 = 110), clear of the objective. */
export const CUE_TOP = PAD + 112;

export const HUD_CSS = `
#run-hud { position: fixed; inset: 0; z-index: 5; pointer-events: none; font: 600 14px/1.3 ui-monospace, Menlo, Consolas, monospace; color: #f2f6ff; }
#run-hud[hidden] { display: none; }
#run-hud .roster { position: absolute; left: ${PAD}px; top: ${ROSTER_TOP}px; max-width: min(300px, 40vw); display: grid; gap: 2px; }
#run-hud .roster .row { overflow-wrap: anywhere; }
#run-hud .roster .row.fallen { text-decoration: line-through; opacity: 0.55; }
#run-hud .roster .trait { color: #aab4c8; font-weight: 400; }
#run-hud .roster .pips { letter-spacing: 0.1em; color: #6cf0a0; }
#run-hud .objective { position: absolute; left: 50%; top: ${OBJECTIVE_TOP}px; transform: translateX(-50%); max-width: 90vw; text-align: center; color: #ffd24a; letter-spacing: 0.05em; }
#run-hud .cue { position: absolute; left: 50%; top: ${CUE_TOP}px; transform: translateX(-50%); max-width: 90vw; text-align: center; color: #ff8a5a; letter-spacing: 0.15em; font-size: 18px; }
#run-hud .cue[hidden] { display: none; }
#run-hud .chatter { position: absolute; left: 50%; bottom: 40px; transform: translateX(-50%); width: min(560px, 90vw); display: grid; gap: 4px; text-align: center; }
#run-hud .chatter .line { padding: 3px 10px; border-radius: 4px; background: rgba(5, 6, 13, 0.7); overflow-wrap: anywhere; }
`;

export interface HudView {
  /** Once per fixed step, after the world step (reads this step's events). */
  step(world: World, dt: number): void;
  draw(world: World): void;
  /** The radio lines on screen now (a presentation layer may draw them its own way). */
  chatterLines(): readonly ChatterLine[];
  dispose(): void;
}

const rowKey = (r: RosterRow): string => `${r.name}|${r.trait}|${r.pips}|${r.fallen}`;

export function createHudView(container: HTMLElement, seed: number): HudView {
  const style = document.createElement('style');
  style.textContent = HUD_CSS;
  const root = document.createElement('div');
  root.id = 'run-hud';
  root.hidden = true;
  const roster = document.createElement('div');
  roster.className = 'roster';
  const objective = document.createElement('div');
  objective.className = 'objective';
  const cue = document.createElement('div');
  cue.className = 'cue';
  cue.hidden = true;
  const feed = document.createElement('div');
  feed.className = 'chatter';
  root.append(roster, objective, cue, feed);
  container.append(style, root);

  let chatter = createChatter(seed);
  let lastRoster = '';
  let lastFeed = '';

  return {
    step(world, dt) {
      if (world.run.mode !== 'run' || menuVisible(world.run)) {
        clearChatter(chatter);
        return;
      }
      feedChatter(chatter, world);
      stepChatter(chatter, dt, world.tuning.chatter);
    },
    draw(world) {
      const text = objectiveText(world);
      root.hidden = text === null;
      if (text === null) return;
      objective.textContent = text;
      const cueLine = cueText(world);
      cue.hidden = cueLine === null;
      if (cueLine !== null && cue.textContent !== cueLine) cue.textContent = cueLine;

      const rows = rosterRows(world);
      const rosterKey = rows.map(rowKey).join('\n');
      if (rosterKey !== lastRoster) {
        lastRoster = rosterKey;
        roster.replaceChildren(
          ...rows.map((r) => {
            const row = document.createElement('div');
            row.className = r.fallen ? 'row fallen' : 'row';
            const trait = document.createElement('span');
            trait.className = 'trait';
            trait.textContent = ` ${r.trait} `;
            const pips = document.createElement('span');
            pips.className = 'pips';
            pips.textContent = r.pips;
            row.append(r.name, trait, pips);
            if (r.fallen) row.append(' (lost)');
            return row;
          }),
        );
      }

      const cfg = world.tuning.chatter;
      const shown = chatter.lines.map((l) => ({
        text: l.text,
        alpha: Math.round(lineAlpha(l, cfg) * 10) / 10,
      }));
      const feedKey = shown.map((l) => `${l.text}@${l.alpha}`).join('\n');
      if (feedKey !== lastFeed) {
        lastFeed = feedKey;
        feed.replaceChildren(
          ...shown.map((l) => {
            const line = document.createElement('div');
            line.className = 'line';
            line.style.opacity = String(l.alpha);
            line.textContent = l.text;
            return line;
          }),
        );
      }
    },
    chatterLines: () => chatter.lines,
    dispose() {
      root.remove();
      style.remove();
      chatter = createChatter(seed);
    },
  };
}
