import { describe, expect, it } from 'vitest';
import { TRAIT_IDS, type TraitId } from '../../data/content/traits';
import { createTuning } from '../../data/tuning';
import { chatterParams } from '../../data/tuning/chatter';
import type { Pilot } from '../core/pilots/pilots';
import type { Wingman } from '../core/squadron/squadron';
import { createWorld, type World } from '../core/world/world';
import {
  clearChatter,
  createChatter,
  feedChatter,
  lineAlpha,
  stepChatter,
  type Chatter,
} from './chatter';
import { CHATTER_KINDS, CHATTER_LINES, validateChatterLines } from './chatter-lines';

const pilot = (id: number, name: string, trait: TraitId = 'bold', lost = false): Pilot => ({
  id,
  name,
  trait,
  kills: 0,
  battles: 0,
  status: lost ? 'lost' : 'active',
  veteran: false,
});

function runWorld(pilots: Pilot[], hulls: number[] = []): World {
  const w = createWorld(7, createTuning());
  w.run.mode = 'run';
  w.run.phase = 'battle';
  w.pilots.roster.push(...pilots);
  hulls.forEach((hp, i) =>
    w.squadron.wingmen.push({ pilotId: pilots[i]!.id, hp, alive: hp > 0 } as Wingman),
  );
  return w;
}

const emit = (w: World, ...events: World['events']['events'][number][]) => {
  w.events.clear();
  for (const e of events) w.events.emit(e);
};

/** Feeds one step and lets the radio speak; returns the visible texts. */
function speak(c: Chatter, w: World, dt = 0.1): string[] {
  feedChatter(c, w);
  stepChatter(c, dt, w.tuning.chatter);
  return c.lines.map((l) => l.text);
}

describe('chatter lines', () => {
  it('has three non-empty lines for every trait and event kind', () => {
    for (const t of TRAIT_IDS)
      for (const k of CHATTER_KINDS) expect(CHATTER_LINES[t][k]).toHaveLength(3);
    expect(() => validateChatterLines()).not.toThrow();
    const broken = structuredClone(CHATTER_LINES);
    broken.bold.kill = ['a', ' ', 'c'];
    expect(() => validateChatterLines(broken)).toThrow(/bold\.kill/);
  });

  it('keeps every line short enough for one row of the feed', () => {
    for (const t of TRAIT_IDS)
      for (const k of CHATTER_KINDS)
        for (const l of CHATTER_LINES[t][k]) expect(l.length).toBeLessThanOrEqual(40);
  });
});

describe('chatter tuning', () => {
  it('has notes within the limit and the spec defaults', () => {
    for (const p of Object.values(chatterParams)) {
      expect(p.note.length).toBeLessThanOrEqual(300);
      expect(p.unit.length).toBeLessThanOrEqual(8);
    }
    expect(chatterParams.chatterGap.default).toBe(2.5);
    expect(chatterParams.chatterLines.default).toBe(3);
    expect(chatterParams.chatterLife.default).toBe(6);
  });
});

describe('feedChatter', () => {
  it('a rescued pilot introduces themself in their own voice', () => {
    const w = runWorld([pilot(1, 'Mara Ember', 'hunter')]);
    emit(w, { type: 'PilotJoined', pilotId: 1, how: 'rescue' });
    const [line] = speak(createChatter(1), w);
    expect(line).toMatch(/^Mara Ember: /);
    expect(CHATTER_LINES.hunter.rescued.map((t) => t.replaceAll('{self}', 'Mara Ember'))).toContain(
      line!.replace('Mara Ember: ', ''),
    );
  });

  it('a lost pilot is named by a surviving squadmate, never by themself', () => {
    const w = runWorld([pilot(1, 'Mara Ember'), pilot(2, 'Joss Wren', 'steady', true)]);
    emit(w, { type: 'PilotLost', pilotId: 2 });
    const [line] = speak(createChatter(3), w);
    expect(line).toMatch(/^Mara Ember: /);
    expect(line).toContain('Joss Wren');
  });

  it('is silent when nobody is left to speak', () => {
    const w = runWorld([pilot(2, 'Joss Wren', 'steady', true)]);
    emit(w, { type: 'PilotLost', pilotId: 2 }, { type: 'BattleCleared', battle: 1 });
    expect(speak(createChatter(3), w)).toEqual([]);
  });

  it('speaks on battle cleared and run won, but not on defeat', () => {
    const w = runWorld([pilot(1, 'Mara Ember')]);
    emit(w, { type: 'BattleCleared', battle: 1 });
    expect(speak(createChatter(1), w)).toHaveLength(1);
    emit(w, { type: 'RunEnded', result: 'victory' });
    expect(speak(createChatter(1), w)).toHaveLength(1);
    emit(w, { type: 'RunEnded', result: 'defeat' });
    expect(speak(createChatter(1), w)).toEqual([]);
  });

  it('kills are called out only by chance (killChance 0 silent, 1 always)', () => {
    const w = runWorld([pilot(1, 'Mara Ember')]);
    w.tuning.chatter.killChance = 0;
    emit(w, { type: 'PilotKill', pilotId: 1 });
    expect(speak(createChatter(1), w)).toEqual([]);
    w.tuning.chatter.killChance = 1;
    expect(speak(createChatter(1), w)).toHaveLength(1);
  });

  it('a hit that leaves a hull low is called out once, not every step and not for a healthy hull', () => {
    const w = runWorld([pilot(1, 'Mara Ember')], [5]);
    const c = createChatter(1);
    emit(w);
    expect(speak(c, w)).toEqual([]); // first sight: nothing to compare with
    w.squadron.wingmen[0]!.hp = 3;
    expect(speak(c, w)).toEqual([]); // hit, but not low
    w.squadron.wingmen[0]!.hp = 1;
    expect(speak(c, w)).toHaveLength(1); // low now
    expect(speak(c, w, 0.1)).toHaveLength(1); // same hull: no second call
    w.squadron.wingmen[0]!.hp = 0;
    stepChatter(c, 10, w.tuning.chatter);
    expect(speak(c, w)).toEqual([]); // dead is not "low"
  });

  it('does nothing in practice mode', () => {
    const w = runWorld([pilot(1, 'Mara Ember')]);
    w.run.mode = 'practice';
    emit(w, { type: 'BattleCleared', battle: 1 });
    expect(speak(createChatter(1), w)).toEqual([]);
  });

  it('never changes the world', () => {
    const w = runWorld([pilot(1, 'Mara Ember')], [2]);
    emit(w, { type: 'PilotJoined', pilotId: 1, how: 'pick' });
    const before = JSON.stringify([w.pilots, w.run, w.events.events]);
    speak(createChatter(1), w);
    expect(JSON.stringify([w.pilots, w.run, w.events.events])).toBe(before);
  });
});

describe('stepChatter', () => {
  const events = (w: World, n: number) => {
    const list: World['events']['events'][number][] = [];
    for (let i = 0; i < n; i++) list.push({ type: 'PilotJoined', pilotId: 1, how: 'pick' });
    emit(w, ...list);
  };

  it('speaks at most one line per chatterGap', () => {
    const w = runWorld([pilot(1, 'Mara Ember')]);
    const c = createChatter(1);
    events(w, 3);
    feedChatter(c, w);
    stepChatter(c, 0.1, w.tuning.chatter);
    expect(c.lines).toHaveLength(1);
    stepChatter(c, 2.0, w.tuning.chatter);
    expect(c.lines).toHaveLength(1); // 2.1 s < 2.5 s
    stepChatter(c, 0.5, w.tuning.chatter);
    expect(c.lines).toHaveLength(2);
  });

  it('keeps at most chatterLines on screen, dropping the oldest', () => {
    const w = runWorld([pilot(1, 'Mara Ember')]);
    w.tuning.chatter.chatterGap = 0;
    w.tuning.chatter.chatterLines = 2;
    const c = createChatter(1);
    for (let i = 0; i < 5; i++) {
      events(w, 1);
      speak(c, w, 0.01);
    }
    expect(c.lines).toHaveLength(2);
  });

  it('lines fade during their last second and are gone after chatterLife', () => {
    const w = runWorld([pilot(1, 'Mara Ember')]);
    const cfg = w.tuning.chatter;
    const c = createChatter(1);
    events(w, 1);
    speak(c, w, 0);
    const line = c.lines[0]!;
    expect(lineAlpha(line, cfg)).toBe(1);
    stepChatter(c, 5.5, cfg);
    expect(lineAlpha(c.lines[0]!, cfg)).toBeCloseTo(0.5, 5);
    stepChatter(c, 0.6, cfg);
    expect(c.lines).toHaveLength(0);
  });

  it('when several lines wait, the most important goes first (a lost pilot over a kill)', () => {
    const w = runWorld([pilot(1, 'Mara Ember'), pilot(2, 'Joss Wren', 'bold', true)]);
    w.tuning.chatter.killChance = 1;
    const c = createChatter(1);
    c.gap = 1; // the radio is busy for a moment
    emit(w, { type: 'PilotKill', pilotId: 1 }, { type: 'PilotLost', pilotId: 2 });
    feedChatter(c, w);
    stepChatter(c, 1, w.tuning.chatter);
    expect(c.lines[0]!.text).toContain('Joss Wren');
  });

  it('a waiting line that is too old is dropped', () => {
    const w = runWorld([pilot(1, 'Mara Ember')]);
    w.tuning.chatter.killChance = 1;
    const c = createChatter(1);
    c.gap = 100;
    emit(w, { type: 'PilotKill', pilotId: 1 });
    feedChatter(c, w);
    expect(c.pending).toHaveLength(1);
    stepChatter(c, 6, w.tuning.chatter);
    expect(c.pending).toHaveLength(0);
  });

  it('clearChatter empties everything', () => {
    const w = runWorld([pilot(1, 'Mara Ember')]);
    const c = createChatter(1);
    events(w, 2);
    speak(c, w);
    clearChatter(c);
    expect(c.lines).toHaveLength(0);
    expect(c.pending).toHaveLength(0);
    expect(c.gap).toBe(0);
  });
});

describe('determinism', () => {
  it('the same seed and the same events give the same text; another seed can differ', () => {
    const script = (seed: number): string[] => {
      const w = runWorld([pilot(1, 'Mara Ember', 'bold'), pilot(2, 'Joss Wren', 'guardian')]);
      w.tuning.chatter.chatterGap = 0;
      w.tuning.chatter.chatterLines = 6;
      w.tuning.chatter.killChance = 1;
      const c = createChatter(seed);
      for (let i = 0; i < 6; i++) {
        emit(w, { type: 'PilotKill', pilotId: 1 + (i % 2) }, { type: 'BattleCleared', battle: i });
        speak(c, w, 0.01);
      }
      return c.lines.map((l) => l.text);
    };
    expect(script(5)).toEqual(script(5));
    expect(script(5).join('|')).not.toBe(script(6).join('|'));
  });
});
