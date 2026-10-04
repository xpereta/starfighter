import { describe, expect, it } from 'vitest';
import { createTuning } from '../../data/tuning';
import type { Pilot } from '../core/pilots/pilots';
import type { Wingman } from '../core/squadron/squadron';
import { createWorld, type World } from '../core/world/world';
import { hostileCount, hullPips, objectiveText, pilotHull, rosterRows } from './roster';

const pilot = (id: number, name: string, lost = false): Pilot => ({
  id,
  name,
  trait: 'steady',
  kills: 0,
  battles: 0,
  status: lost ? 'lost' : 'active',
  veteran: false,
});

function world(): World {
  const w = createWorld(1, createTuning());
  w.run.mode = 'run';
  w.run.phase = 'battle';
  w.run.battle = 2;
  w.run.wave = 2;
  w.targets.length = 0; // the practice arena's dummies and drones
  w.fighters.length = 0;
  return w;
}

describe('hull pips', () => {
  it('draws full and empty pips, clamped, and nothing without a hull', () => {
    expect(hullPips({ hp: 3, max: 5 })).toBe('●●●○○');
    expect(hullPips({ hp: 9, max: 5 })).toBe('●●●●●');
    expect(hullPips({ hp: -1, max: 2 })).toBe('○○');
    expect(hullPips(null)).toBe('');
  });
});

describe('rosterRows', () => {
  it('lists every pilot with the trait label and hull; fallen pilots stay, with no pips', () => {
    const w = world();
    w.pilots.roster.push(
      pilot(1, 'Mara Ember'),
      pilot(2, 'Joss Wren', true),
      pilot(3, 'Ilya Rook'),
    );
    w.squadron.wingmen.push({ hp: 5, alive: true } as Wingman, { hp: 2, alive: true } as Wingman);
    expect(rosterRows(w)).toEqual([
      { name: 'Mara Ember', trait: 'Steady', pips: '●●●●●', fallen: false },
      { name: 'Joss Wren', trait: 'Steady', pips: '', fallen: true },
      { name: 'Ilya Rook', trait: 'Steady', pips: '●●○○○', fallen: false }, // the 2nd active pilot is the 2nd wingman
    ]);
  });

  it('a pilot without a wingman yet has no hull; a downed wingman shows empty pips', () => {
    const w = world();
    const p = pilot(1, 'Mara Ember');
    w.pilots.roster.push(p);
    expect(pilotHull(w, p)).toBeNull();
    w.squadron.wingmen.push({ hp: 0, alive: false } as Wingman);
    expect(pilotHull(w, p)).toEqual({ hp: 0, max: 5 });
  });
});

describe('objective line', () => {
  it('counts hostiles: fighters and non-static targets that are alive', () => {
    const w = world();
    w.fighters.push({ alive: true } as never, { alive: false } as never);
    w.targets.push(
      { alive: true, kind: 'drone' } as never,
      { alive: true, kind: 'static' } as never,
      { alive: true, kind: 'turret' } as never,
      { alive: false, kind: 'drone' } as never,
    );
    expect(hostileCount(w)).toBe(3);
  });

  it('reads BATTLE n/N · WAVE w/W · HOSTILES h with the spec waves per battle', () => {
    const w = world();
    w.fighters.push({ alive: true } as never);
    expect(objectiveText(w)).toBe('BATTLE 2/4 · WAVE 2/3 · HOSTILES 1');
    w.run.battle = 4;
    w.run.wave = 0;
    expect(objectiveText(w)).toBe('BATTLE 4/4 · WAVE 1/4 · HOSTILES 1');
  });

  it('is absent in practice mode and outside a battle', () => {
    const w = world();
    w.run.phase = 'debrief';
    expect(objectiveText(w)).toBeNull();
    w.run.phase = 'battle';
    w.run.mode = 'practice';
    expect(objectiveText(w)).toBeNull();
  });
});
