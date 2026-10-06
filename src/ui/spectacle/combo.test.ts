import { describe, expect, it } from 'vitest';
import { presentation as def } from '../../../data/styles/anime-spectacle/presentation';
import type { GameEvent } from '../../core/events/events';
import {
  createCombo,
  feedAlpha,
  feedCombo,
  multiplierOf,
  stepCombo,
  streakFill,
  tierOf,
} from './combo';

const kill = (kind: 'drone' | 'fighter' | 'wingman' = 'drone'): GameEvent => ({
  type: 'Killed',
  entityId: 1,
  kind,
  x: 0,
  y: 0,
  radius: 10,
});
const names = (id: number): string | undefined => (id === 7 ? 'Mara Vex' : undefined);

describe('combo', () => {
  it('a kill starts a streak, scores, and feeds a line', () => {
    const c = createCombo();
    feedCombo(c, [kill('fighter')], names, def);
    expect(c.count).toBe(1);
    expect(c.score).toBe(def.points.fighter);
    expect(c.feed[0]).toMatchObject({ text: 'FIGHTER DESTROYED', by: 'YOU', streak: 1 });
  });

  it('wingman deaths are not kills', () => {
    const c = createCombo();
    feedCombo(c, [kill('wingman')], names, def);
    expect(c.count).toBe(0);
    expect(c.feed).toHaveLength(0);
  });

  it('a pilot kill names the killer on the latest line', () => {
    const c = createCombo();
    feedCombo(c, [kill(), kill(), { type: 'PilotKill', pilotId: 7 }], names, def);
    expect(c.feed.map((f) => f.by)).toEqual(['YOU', 'Mara Vex']);
  });

  it('the streak breaks after the window and the best stays', () => {
    const c = createCombo();
    feedCombo(c, [kill(), kill()], names, def);
    expect(streakFill(c, def.combo)).toBe(1);
    stepCombo(c, def.combo.window + 0.1, def);
    expect(c.count).toBe(0);
    expect(c.best).toBe(2);
    expect(streakFill(c, def.combo)).toBe(0);
  });

  it('calls each tier once, when it is reached', () => {
    const c = createCombo();
    const first = def.combo.tiers[0]!;
    for (let i = 0; i < first.at - 1; i++) feedCombo(c, [kill()], names, def);
    expect(c.call).toBe('');
    feedCombo(c, [kill()], names, def);
    expect(c.call).toBe(first.label);
    expect(tierOf(first.at, def.combo)).toBe(first.label);
    expect(tierOf(1, def.combo)).toBeNull();
  });

  it('the multiplier grows with the streak and is capped', () => {
    expect(multiplierOf(1, def.combo)).toBe(1);
    expect(multiplierOf(def.combo.step, def.combo)).toBe(1.5);
    expect(multiplierOf(10000, def.combo)).toBe(def.combo.maxMultiplier);
  });

  it('feed lines expire, fade at the end and the list is capped', () => {
    const c = createCombo();
    for (let i = 0; i < 20; i++) feedCombo(c, [kill()], names, def);
    stepCombo(c, 0.01, def);
    expect(c.feed.length).toBeLessThanOrEqual(def.feedLines);
    expect(feedAlpha({ ...c.feed[0]!, age: def.feedLife - 0.5 }, def)).toBeCloseTo(0.5);
    stepCombo(c, def.feedLife + 1, def);
    expect(c.feed).toHaveLength(0);
  });

  it('a new run (battle 1) resets the score and streak', () => {
    const c = createCombo();
    feedCombo(c, [kill()], names, def);
    feedCombo(c, [{ type: 'BattleStarted', battle: 1 }], names, def);
    expect(c.score).toBe(0);
    expect(c.count).toBe(0);
  });
});
