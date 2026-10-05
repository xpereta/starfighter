import { TRAITS } from '../../../data/content/traits';
import { splitName } from './comm';
import type { MenuData, MenuKind, MenuScreen } from '../menu-model';
import type { PresentationDef } from './presentation';
import { scoreText } from './hud-model';

/**
 * The cinematic menus as plain data: what to show on the Start screen, the debrief and the end
 * screen, built from the same `MenuScreen` the classic menus use (the cursor and the items are
 * the game's own; only the dressing is new). Pure and unit-tested; `menu-dom.ts` draws it.
 */

export interface LayoutItem {
  id: string;
  label: string;
  detail?: string;
  checked?: boolean;
  /** The pilot whose portrait goes on the item (veterans and candidates). */
  portrait?: string;
  kind: 'veteran' | 'pick' | 'action';
}

export interface SquadCard {
  name: string;
  first: string;
  callsign: string;
  trait: string;
  fallen: boolean;
}

export interface MenuLayout {
  kind: MenuKind;
  tone: 'neutral' | 'cleared' | 'victory' | 'defeat';
  kicker: string;
  title: string;
  /** The smaller words under the title. */
  notes: string[];
  stats: { label: string; value: string }[];
  squad: SquadCard[];
  items: LayoutItem[];
  cursor: number;
  hint: string;
}

/** The run numbers the world keeps that the classic menu data leaves out. */
export interface MenuExtras {
  battleKills: number;
  battleLost: number;
  /** UI-only score and best streak of this run. */
  score: number;
  bestStreak: number;
}

const HINT = 'D-PAD / STICK / W S: MOVE      A / ENTER / SPACE: CHOOSE      B / ESC: BACK';

function squadOf(data: MenuData): SquadCard[] {
  return data.roster.map((p) => {
    const { first, callsign } = splitName(p.name);
    return {
      name: p.name,
      first,
      callsign,
      trait: TRAITS[p.trait].label,
      fallen: p.status === 'lost',
    };
  });
}

function itemsOf(screen: MenuScreen, data: MenuData): LayoutItem[] {
  return screen.items.map((item) => {
    const out: LayoutItem = { id: item.id, label: item.label, kind: 'action' };
    if (item.detail !== undefined) out.detail = item.detail;
    if (item.checked !== undefined) out.checked = item.checked;
    if (item.id.startsWith('veteran:')) {
      const v = data.veterans.find((x) => `veteran:${x.id}` === item.id);
      out.kind = 'veteran';
      if (v) out.portrait = v.name;
    } else if (item.id.startsWith('pick:')) {
      const c = data.candidates[Number(item.id.slice(5))];
      out.kind = 'pick';
      if (c) out.portrait = c.name;
    }
    return out;
  });
}

export function buildMenuLayout(
  screen: MenuScreen,
  data: MenuData,
  extras: MenuExtras,
  def: PresentationDef,
): MenuLayout {
  const w = def.words;
  const base = {
    kind: screen.kind,
    items: itemsOf(screen, data),
    cursor: screen.cursor,
    hint: HINT,
  };
  if (screen.kind === 'start') {
    return {
      ...base,
      tone: 'neutral',
      kicker: w.tagline,
      title: screen.title,
      notes: screen.lines,
      stats: [
        { label: w.battle + 'S', value: String(data.battles) },
        { label: 'VETERANS', value: `${data.selectedVeterans.length}/${data.maxVeterans}` },
        { label: 'BEST RUN', value: data.bestRun === null ? '--' : String(data.bestRun) },
      ],
      squad: [],
    };
  }
  if (screen.kind === 'debrief') {
    return {
      ...base,
      tone: 'cleared',
      kicker: `${w.battle} ${data.battle} / ${data.battles}`,
      title: w.cleared,
      notes: screen.lines,
      stats: [
        { label: 'KILLS', value: String(extras.battleKills) },
        { label: 'PILOTS LOST', value: String(extras.battleLost) },
        { label: 'SCORE', value: scoreText(extras.score) },
      ],
      squad: squadOf(data),
    };
  }
  const won = data.result === 'victory';
  const cleared = won ? data.battles : Math.max(0, data.battle - 1);
  return {
    ...base,
    tone: won ? 'victory' : 'defeat',
    kicker: w.tagline,
    title: won ? w.victory : w.defeat,
    notes: screen.lines,
    stats: [
      { label: `${w.battle}S CLEARED`, value: `${cleared}/${data.battles}` },
      { label: 'SCORE', value: scoreText(extras.score) },
      { label: 'BEST STREAK', value: String(extras.bestStreak) },
    ],
    squad: squadOf(data),
  };
}

/** A string that changes when the picture's structure would, ignoring the cursor (the cursor only moves a highlight). */
export function structureKey(layout: MenuLayout): string {
  return JSON.stringify({ ...layout, cursor: 0 });
}
