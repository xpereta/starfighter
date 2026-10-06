import { describe, expect, it } from 'vitest';
import { spectacle } from '../../../data/styles/anime-spectacle/spectacle';
import { cardFor } from './cards';

const def = spectacle.cards!;

describe('title cards', () => {
  it('a battle start gives an intro card with the battle number and cycling title and subtitle', () => {
    const c = cardFor({ type: 'BattleStarted', battle: 2 }, def)!;
    expect(c.kind).toBe('intro');
    expect(c.kicker).toBe('BATTLE 2');
    expect(c.title).toBe(def.battleTitles[1]);
    expect(c.subtitle).toBe(def.subtitles[1]);
    expect(c.seconds).toBe(def.duration);
    const wrap = cardFor({ type: 'BattleStarted', battle: def.battleTitles.length + 1 }, def)!;
    expect(wrap.title).toBe(def.battleTitles[0]);
  });

  it('clearing a battle, losing a pilot and ending the run each have their own card', () => {
    expect(cardFor({ type: 'BattleCleared', battle: 1 }, def)!.kind).toBe('outro');
    expect(cardFor({ type: 'PilotLost', pilotId: 3 }, def)!.title).toBe(def.pilotLost);
    expect(cardFor({ type: 'RunEnded', result: 'victory' }, def)!.title).toBe(def.victory);
    expect(cardFor({ type: 'RunEnded', result: 'defeat' }, def)!.title).toBe(def.defeat);
  });

  it('other events ask for nothing, and every card is shorter than ten seconds', () => {
    expect(cardFor({ type: 'MenuTick', checked: true }, def)).toBeNull();
    expect(cardFor({ type: 'ShotFired', x: 0, y: 0, angle: 0 }, def)).toBeNull();
    for (const e of [
      { type: 'BattleStarted', battle: 1 },
      { type: 'RunEnded', result: 'victory' },
      { type: 'RunEnded', result: 'defeat' },
      { type: 'PilotLost', pilotId: 1 },
    ] as const)
      expect(cardFor(e, def)!.seconds).toBeLessThan(10);
  });
});
