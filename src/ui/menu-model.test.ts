import { describe, expect, it } from 'vitest';
import { TRAITS } from '../../data/content/traits';
import { createTuning } from '../../data/tuning';
import type { Pilot } from '../core/pilots/pilots';
import { createWorld } from '../core/world/world';
import {
  buildScreen,
  debriefScreen,
  endScreen,
  menuDataFromWorld,
  menuVisible,
  startScreen,
  type MenuData,
} from './menu-model';

const pilot = (id: number, name: string, status: Pilot['status'] = 'active'): Pilot => ({
  id,
  name,
  trait: 'bold',
  kills: id,
  battles: 1,
  status,
  veteran: false,
});

const base = (over: Partial<MenuData> = {}): MenuData => ({
  phase: 'start',
  battle: 0,
  battles: 4,
  result: 'none',
  cursor: 0,
  roster: [],
  veterans: [],
  selectedVeterans: [],
  maxVeterans: 2,
  bestRun: null,
  candidates: [],
  squadFull: false,
  ...over,
});

const veteran = (id: number) => ({
  id,
  name: `Vet ${id}`,
  trait: 'steady' as const,
  kills: 7,
  runs: 2,
});

describe('menuVisible', () => {
  it('only in run mode and outside the battle phase', () => {
    expect(menuVisible({ mode: 'practice', phase: 'battle' })).toBe(false);
    expect(menuVisible({ mode: 'practice', phase: 'start' })).toBe(false); // practice never shows menus
    expect(menuVisible({ mode: 'run', phase: 'battle' })).toBe(false);
    for (const phase of ['start', 'debrief', 'end'] as const) {
      expect(menuVisible({ mode: 'run', phase })).toBe(true);
    }
  });
});

describe('Start screen', () => {
  it('with no veterans: a single START RUN item, an encouraging note and the best run', () => {
    const s = startScreen(base());
    expect(s.kind).toBe('start');
    expect(s.items.map((i) => i.id)).toEqual(['start']);
    expect(s.lines.join(' ')).toMatch(/No veterans yet/);
    expect(s.lines.join(' ')).toMatch(/No finished run yet/);
    expect(s.lines.join(' ')).toMatch(/4 battles/);
  });

  it('lists veterans as tick boxes ahead of START RUN, with trait, kills and runs', () => {
    const s = startScreen(
      base({ veterans: [veteran(5), veteran(6)], selectedVeterans: [6], bestRun: 3 }),
    );
    expect(s.items.map((i) => i.id)).toEqual(['veteran:5', 'veteran:6', 'start']);
    expect(s.items[0]!.checked).toBe(false);
    expect(s.items[1]!.checked).toBe(true);
    expect(s.items[0]!.label).toBe(`Vet 5 (${TRAITS.steady.label})`);
    expect(s.items[0]!.detail).toBe('7 kills · 2 runs survived');
    expect(s.lines.join(' ')).toMatch(/Bring up to 2 veterans \(1 chosen\)/);
    expect(s.lines.join(' ')).toMatch(/Best run: 3 battles cleared/);
    expect(s.items[2]!.checked).toBeUndefined(); // START RUN is not a tick box
  });
});

describe('Debrief screen', () => {
  const roster = [pilot(1, 'Mara Ember'), pilot(2, 'Joss Wren', 'lost')];

  it('offers the candidates with what their trait does, and a skip item last', () => {
    const s = debriefScreen(
      base({
        phase: 'debrief',
        battle: 2,
        roster,
        candidates: [
          { name: 'Ilya Rook', trait: 'hunter' },
          { name: 'Rhea Halo', trait: 'guardian' },
          { name: 'Dario Flint', trait: 'steady' },
        ],
      }),
    );
    expect(s.title).toBe('BATTLE 2 OF 4 CLEARED');
    expect(s.items.map((i) => i.id)).toEqual(['pick:0', 'pick:1', 'pick:2', 'skip']);
    expect(s.items[0]!.detail).toBe(TRAITS.hunter.blurb);
    expect(s.lines.join(' ')).toMatch(/Squad: Mara Ember \(Bold\)/);
    expect(s.lines.join(' ')).toMatch(/Lost: Joss Wren/);
    expect(s.lines.join(' ')).toMatch(/Choose a pilot/);
  });

  it('with a full squad (or nobody to offer) there is just CONTINUE', () => {
    const full = debriefScreen(
      base({
        phase: 'debrief',
        battle: 1,
        roster,
        squadFull: true,
        candidates: [{ name: 'X Y', trait: 'bold' }],
      }),
    );
    expect(full.items.map((i) => i.id)).toEqual(['continue']);
    expect(full.lines.join(' ')).toMatch(/squad is full/);
    const none = debriefScreen(base({ phase: 'debrief', battle: 1, roster }));
    expect(none.items.map((i) => i.id)).toEqual(['continue']);
  });

  it('says so when you are flying alone', () => {
    const s = debriefScreen(base({ phase: 'debrief', battle: 1 }));
    expect(s.lines[0]).toMatch(/flying alone/);
  });
});

describe('End screen', () => {
  const roster = [pilot(1, 'Mara Ember'), pilot(2, 'Joss Wren', 'lost')];

  it('victory: all battles cleared, who survived and who fell, saved as veterans', () => {
    const s = endScreen(base({ phase: 'end', result: 'victory', battle: 4, roster }));
    expect(s.title).toBe('VICTORY');
    expect(s.lines.join(' ')).toMatch(/Battles cleared: 4 of 4/);
    expect(s.lines.join(' ')).toMatch(/Survived: Mara Ember \(Bold\)/);
    expect(s.lines.join(' ')).toMatch(/Lost: Joss Wren/);
    expect(s.lines.join(' ')).toMatch(/saved as veterans/);
    expect(s.items.map((i) => i.id)).toEqual(['restart']);
  });

  it('defeat in battle 3: two battles cleared, and no pilot survived is stated plainly', () => {
    const s = endScreen(
      base({ phase: 'end', result: 'defeat', battle: 3, roster: [pilot(2, 'Joss Wren', 'lost')] }),
    );
    expect(s.title).toBe('DEFEAT');
    expect(s.lines.join(' ')).toMatch(/Battles cleared: 2 of 4/);
    expect(s.lines.join(' ')).toMatch(/No pilot survived/);
    expect(s.lines.join(' ')).not.toMatch(/saved as veterans/);
  });
});

describe('buildScreen and the cursor', () => {
  it('picks the screen for the phase, and none during a battle', () => {
    expect(buildScreen(base({ phase: 'start' }))!.kind).toBe('start');
    expect(buildScreen(base({ phase: 'debrief', battle: 1 }))!.kind).toBe('debrief');
    expect(buildScreen(base({ phase: 'end', result: 'victory' }))!.kind).toBe('end');
    expect(buildScreen(base({ phase: 'battle' }))).toBeNull();
  });

  it('always keeps the cursor inside the items', () => {
    expect(startScreen(base({ cursor: 9 })).cursor).toBe(0);
    expect(startScreen(base({ veterans: [veteran(1)], cursor: 9 })).cursor).toBe(1);
    expect(startScreen(base({ veterans: [veteran(1)], cursor: -3 })).cursor).toBe(0);
    expect(endScreen(base({ phase: 'end', cursor: 5 })).cursor).toBe(0);
  });
});

describe('menuDataFromWorld', () => {
  const extras = {
    veterans: [veteran(9)],
    selectedVeterans: [9],
    candidates: [{ name: 'Extra One', trait: 'bold' as const }],
    bestRun: 2,
  };

  it('reads the contract fields and falls back to the extras and the spec defaults', () => {
    const w = createWorld(1, createTuning());
    w.run.mode = 'run';
    w.run.phase = 'debrief';
    w.run.battle = 2;
    w.run.cursor = 1;
    w.pilots.roster.push(pilot(1, 'Mara Ember'));
    const d = menuDataFromWorld(w, extras);
    expect(d).toMatchObject({
      phase: 'debrief',
      battle: 2,
      battles: 4,
      cursor: 1,
      maxVeterans: 2,
      bestRun: 2,
    });
    expect(d.roster).toHaveLength(1);
    expect(d.selectedVeterans).toEqual([9]);
    expect(d.candidates).toEqual([{ name: 'Extra One', trait: 'bold' }]);
    expect(d.squadFull).toBe(false);
  });

  it('prefers the run state when track A provides candidates and selected veterans, and the tuned limits', () => {
    const w = createWorld(1, createTuning());
    Object.assign(w.run, { candidates: [pilot(7, 'Run Pick')], selectedVeterans: [3] });
    Object.assign(w.tuning, {
      run: { battleCount: 5 },
      pilots: { squadMax: 2, veteransPerRun: 3 },
    });
    w.pilots.roster.push(pilot(1, 'A B'), pilot(2, 'C D'));
    const d = menuDataFromWorld(w, extras);
    expect(d.candidates).toEqual([{ name: 'Run Pick', trait: 'bold' }]);
    expect(d.selectedVeterans).toEqual([3]);
    expect(d.battles).toBe(5);
    expect(d.maxVeterans).toBe(3);
    expect(d.squadFull).toBe(true);
  });

  it('lost pilots do not fill the squad', () => {
    const w = createWorld(1, createTuning());
    for (let i = 1; i <= 4; i++)
      w.pilots.roster.push(pilot(i, `P${i}`, i === 4 ? 'lost' : 'active'));
    expect(menuDataFromWorld(w, extras).squadFull).toBe(false);
  });
});
