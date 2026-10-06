import { describe, expect, it } from 'vitest';
import { presentation as def } from '../../../data/styles/anime-spectacle/presentation';
import { buildScreen, debriefScreen, endScreen, startScreen, type MenuData } from '../menu-model';
import { buildMenuLayout, structureKey, type MenuExtras } from './menu-layout';

const data = (over: Partial<MenuData> = {}): MenuData => ({
  phase: 'start',
  battle: 2,
  battles: 4,
  result: 'none',
  cursor: 0,
  roster: [
    {
      id: 1,
      name: 'Mara Vex',
      trait: 'bold',
      kills: 3,
      battles: 1,
      status: 'active',
      veteran: false,
    },
    {
      id: 2,
      name: 'Joss Hale',
      trait: 'steady',
      kills: 0,
      battles: 1,
      status: 'lost',
      veteran: false,
    },
  ],
  veterans: [{ id: 9, name: 'Old Hand', trait: 'steady', kills: 12 }],
  selectedVeterans: [9],
  maxVeterans: 2,
  bestRun: 3,
  candidates: [
    { name: 'Nadia Quill', trait: 'hunter' },
    { name: 'Kenji Moth', trait: 'guardian' },
  ],
  squadFull: false,
  ...over,
});
const extras: MenuExtras = { battleKills: 14, battleLost: 1, score: 4200, bestStreak: 9 };

describe('start layout', () => {
  it('shows the tagline and title, run stats and a portrait per veteran', () => {
    const d = data();
    const l = buildMenuLayout(startScreen(d), d, extras, def);
    expect(l.tone).toBe('neutral');
    expect(l.kicker).toBe(def.words.tagline);
    expect(l.title).toBe('STARFIGHTER');
    expect(l.stats.map((s) => s.value)).toEqual(['4', '1/2', '3']);
    expect(l.items[0]).toMatchObject({ kind: 'veteran', portrait: 'Old Hand', checked: true });
    expect(l.items.at(-1)).toMatchObject({ id: 'start', kind: 'action' });
    expect(l.items.at(-1)!.portrait).toBeUndefined();
  });

  it('shows -- when there is no best run yet', () => {
    const d = data({ bestRun: null, veterans: [], selectedVeterans: [] });
    expect(buildMenuLayout(startScreen(d), d, extras, def).stats[2]!.value).toBe('--');
  });
});

describe('debrief layout', () => {
  it('is a cleared card with the battle stats, the squad and a portrait per candidate', () => {
    const d = data({ phase: 'debrief' });
    const l = buildMenuLayout(debriefScreen(d), d, extras, def);
    expect(l.tone).toBe('cleared');
    expect(l.title).toBe(def.words.cleared);
    expect(l.kicker).toBe('BATTLE 2 / 4');
    expect(l.stats.map((s) => s.value)).toEqual(['14', '1', '004200']);
    expect(l.squad.map((s) => [s.first, s.fallen])).toEqual([
      ['Mara', false],
      ['Joss', true],
    ]);
    expect(l.items.filter((i) => i.kind === 'pick').map((i) => i.portrait)).toEqual([
      'Nadia Quill',
      'Kenji Moth',
    ]);
    expect(l.items.at(-1)!.id).toBe('skip');
  });
});

describe('end layout', () => {
  it('victory and defeat get their own tone and words', () => {
    const win = data({ phase: 'end', result: 'victory', battle: 4 });
    const lose = data({ phase: 'end', result: 'defeat', battle: 3 });
    const w = buildMenuLayout(endScreen(win), win, extras, def);
    const l = buildMenuLayout(endScreen(lose), lose, extras, def);
    expect([w.tone, w.title]).toEqual(['victory', def.words.victory]);
    expect([l.tone, l.title]).toEqual(['defeat', def.words.defeat]);
    expect(w.stats[0]!.value).toBe('4/4');
    expect(l.stats[0]!.value).toBe('2/4');
    expect(w.stats[2]!.value).toBe('9');
  });
});

describe('structure key', () => {
  it('ignores the cursor but not the content', () => {
    const d = data({ phase: 'debrief' });
    const a = buildMenuLayout(debriefScreen(d), d, extras, def);
    const b = buildMenuLayout(debriefScreen({ ...d, cursor: 1 }), { ...d, cursor: 1 }, extras, def);
    expect(b.cursor).toBe(1);
    expect(structureKey(a)).toBe(structureKey(b));
    const c = buildMenuLayout(debriefScreen(d), d, { ...extras, battleKills: 15 }, def);
    expect(structureKey(c)).not.toBe(structureKey(a));
  });

  it('builds no layout while a battle is on (the screen is null)', () => {
    expect(buildScreen(data({ phase: 'battle' }))).toBeNull();
  });
});
