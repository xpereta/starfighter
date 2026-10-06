import { describe, expect, it } from 'vitest';
import { createTuning } from '../../../data/tuning';
import { spawnFighter } from '../ai/waves';
import { activeCount } from '../pilots/pilots';
import { createWorld, stepWorld, type World } from '../world/world';
import {
  devClearBattle,
  devClearEnemies,
  devJumpTo,
  devNextWave,
  devRestore,
  enemyCounts,
  jumpLabel,
  jumpTargets,
  nextBattleTarget,
} from './dev-actions';
import { enterStartScreen } from './run';

const DT = 1 / 60;

function runWorld(): World {
  const tuning = createTuning();
  tuning.fighter.waveDelay = 1;
  const w = createWorld(3, tuning);
  enterStartScreen(w);
  return w;
}

describe('jumpTargets', () => {
  it('lists start, every battle, debrief, and both ends', () => {
    expect(jumpTargets(4).map(jumpLabel)).toEqual([
      'Start screen',
      'Battle 1',
      'Battle 2',
      'Battle 3',
      'Battle 4',
      'Debrief',
      'End: victory',
      'End: defeat',
    ]);
  });
  it('has no debrief in a one-battle run', () => {
    expect(jumpTargets(1).map(jumpLabel)).not.toContain('Debrief');
  });
});

describe('devJumpTo', () => {
  it('jumps from the start screen to battle 3 with a roster, a clean field and the real counters', () => {
    const w = runWorld();
    const cfg = w.tuning.run;
    devJumpTo(w, { kind: 'battle', n: 3 });
    expect(w.run).toMatchObject({
      mode: 'run',
      phase: 'battle',
      battle: 3,
      wave: 0,
      hull: cfg.playerHull,
      result: 'none',
    });
    expect(w.run.waveTotal).toBe(3);
    expect(activeCount(w.pilots)).toBe(cfg.startingSquad);
    expect(w.fighters).toHaveLength(0);
    expect(w.pods).toHaveLength(0);
    expect(w.enemyShots.count).toBe(0);
    expect(w.targets.filter((t) => t.kind === 'turret')).toHaveLength(2); // battle 3 has turrets
  });

  it('then plays on: wave 1 arrives through the real battle step', () => {
    const w = runWorld();
    devJumpTo(w, { kind: 'battle', n: 2 });
    for (let i = 0; i < 5; i++) stepWorld(w, DT);
    expect(w.run.wave).toBe(1);
    expect(enemyCounts(w).fighters).toBeGreaterThan(0);
  });

  it('jumps from practice mode (no run yet)', () => {
    const w = createWorld(1, createTuning());
    expect(w.run.mode).toBe('practice');
    devJumpTo(w, { kind: 'battle', n: 1 });
    expect(w.run).toMatchObject({ mode: 'run', phase: 'battle', battle: 1 });
    expect(activeCount(w.pilots)).toBeGreaterThan(0);
  });

  it('keeps the squad when jumping between battles, and clears shots and pods', () => {
    const w = runWorld();
    devJumpTo(w, { kind: 'battle', n: 2 });
    const names = w.pilots.roster.map((p) => p.name);
    w.enemyShots.spawn();
    w.pods.push({
      x: 1,
      y: 1,
      vx: 0,
      vy: 0,
      hp: 1,
      alive: true,
      progress: 0,
      pilotId: 0,
      battle: 2,
      rescued: false,
    });
    devJumpTo(w, { kind: 'battle', n: 4 });
    expect(w.pilots.roster.map((p) => p.name)).toEqual(names);
    expect(w.enemyShots.count).toBe(0);
    expect(w.pods).toHaveLength(0);
    expect(w.run.battle).toBe(4);
  });

  it('jumps to the start screen', () => {
    const w = runWorld();
    devJumpTo(w, { kind: 'battle', n: 2 });
    devJumpTo(w, { kind: 'start' });
    expect(w.run).toMatchObject({ phase: 'start', battle: 0 });
    expect(w.pilots.roster).toHaveLength(0);
  });

  it('debrief: after the current battle, hull restored, candidates generated', () => {
    const w = runWorld();
    devJumpTo(w, { kind: 'battle', n: 2 });
    w.run.hull = 1;
    devJumpTo(w, { kind: 'debrief' });
    expect(w.run.phase).toBe('debrief');
    expect(w.run.battle).toBe(2);
    expect(w.run.hull).toBe(w.tuning.run.playerHull);
    expect(w.run.candidates).toHaveLength(w.tuning.pilots.pickCount);
    expect(w.run.cursor).toBe(0);
  });

  it('debrief from outside a battle uses battle 1; after the last battle it falls back one', () => {
    const w = runWorld();
    devJumpTo(w, { kind: 'debrief' });
    expect(w.run).toMatchObject({ phase: 'debrief', battle: 1 });
    devJumpTo(w, { kind: 'battle', n: w.tuning.run.battleCount });
    devJumpTo(w, { kind: 'debrief' });
    expect(w.run).toMatchObject({ phase: 'debrief', battle: w.tuning.run.battleCount - 1 });
  });

  it('debrief is refused in a one-battle run', () => {
    const w = runWorld();
    w.tuning.run.battleCount = 1;
    expect(() => devJumpTo(w, { kind: 'debrief' })).toThrow(/no debrief/);
  });

  it('end: victory and defeat use the real end', () => {
    const w = runWorld();
    devJumpTo(w, { kind: 'end', result: 'victory' });
    expect(w.run).toMatchObject({ phase: 'end', result: 'victory' });
    expect(w.run.battle).toBe(w.tuning.run.battleCount);
    devJumpTo(w, { kind: 'end', result: 'defeat' });
    expect(w.run).toMatchObject({ phase: 'end', result: 'defeat', hull: 0 });
  });

  it('a battle can be entered again from the end screen with a clean result', () => {
    const w = runWorld();
    devJumpTo(w, { kind: 'end', result: 'defeat' });
    devJumpTo(w, { kind: 'battle', n: 1 });
    expect(w.run).toMatchObject({ phase: 'battle', result: 'none', battle: 1 });
    expect(activeCount(w.pilots)).toBe(w.tuning.run.startingSquad);
  });

  it('rejects battles that do not exist', () => {
    const w = runWorld();
    expect(() => devJumpTo(w, { kind: 'battle', n: 0 })).toThrow(/does not exist/);
    expect(() => devJumpTo(w, { kind: 'battle', n: 99 })).toThrow(/does not exist/);
    expect(() => devJumpTo(w, { kind: 'battle', n: 1.5 })).toThrow(/does not exist/);
  });
});

describe('nextBattleTarget', () => {
  it('walks 1..N then stops', () => {
    const w = runWorld();
    expect(nextBattleTarget(w)).toEqual({ kind: 'battle', n: 1 });
    devJumpTo(w, { kind: 'battle', n: 2 });
    expect(nextBattleTarget(w)).toEqual({ kind: 'battle', n: 3 });
    devJumpTo(w, { kind: 'debrief' });
    expect(nextBattleTarget(w)).toEqual({ kind: 'battle', n: 3 });
    devJumpTo(w, { kind: 'battle', n: w.tuning.run.battleCount });
    expect(nextBattleTarget(w)).toBeNull();
    devJumpTo(w, { kind: 'end', result: 'defeat' });
    expect(nextBattleTarget(w)).toEqual({ kind: 'battle', n: 1 });
  });
  it('is battle 1 in practice', () => {
    expect(nextBattleTarget(createWorld(1, createTuning()))).toEqual({ kind: 'battle', n: 1 });
  });
});

describe('waves and clearing', () => {
  it('next wave advances the battle wave counter up to the last wave, then refuses', () => {
    const w = runWorld();
    devJumpTo(w, { kind: 'battle', n: 1 });
    devNextWave(w);
    expect(w.run.wave).toBe(1);
    expect(enemyCounts(w).fighters).toBe(3);
    devNextWave(w);
    expect(w.run.wave).toBe(2);
    expect(w.run.wave).toBe(w.run.waveTotal);
    expect(() => devNextWave(w)).toThrow(/last wave/);
  });

  it('next wave is refused on a menu and adds a wave in practice', () => {
    const w = runWorld();
    expect(() => devNextWave(w)).toThrow(/no battle/);
    const p = createWorld(1, createTuning());
    devNextWave(p);
    expect(enemyCounts(p).fighters).toBe(p.tuning.fighter.waveSize);
  });

  it('clear battle ends the battle (debrief), and victory in the last one', () => {
    const w = runWorld();
    devJumpTo(w, { kind: 'battle', n: 1 });
    devNextWave(w);
    devClearBattle(w);
    stepWorld(w, DT);
    expect(w.run.phase).toBe('debrief');
    expect(enemyCounts(w).fighters).toBe(0);

    devJumpTo(w, { kind: 'battle', n: w.tuning.run.battleCount });
    devClearBattle(w);
    // The last battle is the capital ship: its core dies at once and the death chain runs before the victory.
    for (let i = 0; i < 60 * (w.tuning.capital.deathChainTime + 1); i++) stepWorld(w, DT);
    expect(w.run).toMatchObject({ phase: 'end', result: 'victory' });
  });

  it('clear battle is refused outside a battle', () => {
    expect(() => devClearBattle(runWorld())).toThrow(/no battle/);
  });

  it('a spawned fighter keeps the battle from ending until it is dead', () => {
    const w = runWorld();
    devJumpTo(w, { kind: 'battle', n: 1 });
    w.run.wave = w.run.waveTotal;
    spawnFighter(w, 500, 0, 0);
    for (let i = 0; i < 30; i++) stepWorld(w, DT);
    expect(w.run.phase).toBe('battle');
    for (const f of w.fighters) f.hp = 0;
    for (let i = 0; i < 5; i++) stepWorld(w, DT);
    expect(w.run.phase).not.toBe('battle');
  });

  it('clear enemies removes targets, kills fighters and drops shots, missiles and locks', () => {
    const w = createWorld(1, createTuning());
    spawnFighter(w, 500, 0, 0);
    w.enemyShots.spawn();
    w.lockon.locks.push(1);
    devClearEnemies(w);
    stepWorld(w, DT);
    expect(w.targets).toHaveLength(0);
    expect(enemyCounts(w)).toEqual({ fighters: 0, gunships: 0, targets: 0 });
    expect(w.enemyShots.count).toBe(0);
    expect(w.lockon.locks).toHaveLength(0);
  });
});

describe('devRestore', () => {
  it('refills hull and wingmen and fills the squad', () => {
    const w = runWorld();
    devJumpTo(w, { kind: 'battle', n: 2 });
    stepWorld(w, DT);
    w.run.hull = 1;
    for (const wm of w.squadron.wingmen) wm.hp = 1;
    w.pilots.roster[0]!.status = 'lost';
    devRestore(w);
    expect(w.run.hull).toBe(w.tuning.run.playerHull);
    expect(activeCount(w.pilots)).toBe(w.tuning.run.startingSquad);
    for (const wm of w.squadron.wingmen) if (wm.alive) expect(wm.hp).toBeGreaterThan(1);
  });
});
