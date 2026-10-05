import { describe, expect, it } from 'vitest';
import { createTuning } from '../../../data/tuning';
import { activeCount } from '../pilots/pilots';
import { hashWorld } from '../replay/hash';
import { createWorld, stepWorld, type World } from '../world/world';
import {
  enterStartScreen,
  menuRows,
  offerVeterans,
  battleDefOf,
  turretsIn,
  wavesIn,
  waveSizeIn,
  type OfferedVeteran,
} from './run';

const DT = 1 / 60;
type Button = 'menuUp' | 'menuDown' | 'menuSelect' | 'menuBack';

/** A run-mode world on the Start screen, with a short wave delay so the tests stay small. */
function startWorld(seed = 7): World {
  const tuning = createTuning();
  tuning.fighter.waveDelay = 1;
  const w = createWorld(seed, tuning);
  enterStartScreen(w);
  return w;
}

/** Presses a menu button for one step and lets go for one more (a held button counts once). */
function press(w: World, button: Button): void {
  w.actions[button] = true;
  stepWorld(w, DT);
  w.actions[button] = false;
  stepWorld(w, DT);
}

function events(w: World, type: string): number {
  return w.events.events.filter((e) => e.type === type).length;
}

/** Destroys the wave on the field and steps until the next phase or wave begins. */
function clearWave(w: World): void {
  const wave = w.run.wave;
  const battle = w.run.battle;
  for (const f of w.fighters) if (f.alive) f.hp = 0;
  for (let i = 0; i < 300; i++) {
    stepWorld(w, DT);
    if (w.run.phase !== 'battle' || w.run.battle !== battle || w.run.wave !== wave) return;
  }
  throw new Error('the wave never advanced');
}

function clearBattle(w: World): void {
  const battle = w.run.battle;
  for (let i = 0; i < 20 && w.run.phase === 'battle' && w.run.battle === battle; i++) clearWave(w);
}

const veteran = (id: number): OfferedVeteran => ({
  id,
  name: `Vet ${id}`,
  trait: 'steady',
  kills: id,
});

describe('battle sizes', () => {
  const cfg = createTuning().run;
  it('four battles have 2, 3, 3 and 4 waves, growing waves, and turrets from battle 3', () => {
    expect([1, 2, 3, 4].map((n) => wavesIn(cfg, n))).toEqual([2, 3, 3, 4]);
    expect([1, 2, 3, 4].map((n) => waveSizeIn(cfg, n))).toEqual([3, 4, 5, 6]);
    expect([1, 2, 3, 4].map((n) => turretsIn(cfg, n))).toEqual([0, 0, 2, 3]);
  });
});

describe('the start screen', () => {
  it('holds the world still while a menu is up', () => {
    const w = startWorld();
    w.actions.throttle = 1;
    for (let i = 0; i < 30; i++) stepWorld(w, DT);
    expect(w.ship.x).toBe(0);
    expect(w.ship.y).toBe(0);
    expect(w.fighters).toHaveLength(0);
    expect(w.run).toMatchObject({ mode: 'run', phase: 'start', battle: 0 });
  });

  it('moves the cursor once per press, wrapping, and a held button does not repeat', () => {
    const w = startWorld();
    offerVeterans(w, [veteran(5), veteran(6)]);
    expect(menuRows(w.run)).toBe(3);
    w.actions.menuDown = true;
    for (let i = 0; i < 10; i++) stepWorld(w, DT); // held
    expect(w.run.cursor).toBe(1);
    w.actions.menuDown = false;
    stepWorld(w, DT);
    press(w, 'menuDown');
    expect(w.run.cursor).toBe(2);
    press(w, 'menuDown');
    expect(w.run.cursor).toBe(0); // wraps
    press(w, 'menuUp');
    expect(w.run.cursor).toBe(2);
  });

  it('ticks veterans up to veteransPerRun and unticks them again', () => {
    const w = startWorld();
    w.tuning.pilots.veteransPerRun = 2;
    offerVeterans(w, [veteran(5), veteran(6), veteran(7)]);
    press(w, 'menuSelect'); // veteran 5
    press(w, 'menuDown');
    press(w, 'menuSelect'); // veteran 6
    press(w, 'menuDown');
    press(w, 'menuSelect'); // veteran 7: over the limit
    expect(w.run.selectedVeterans).toEqual([5, 6]);
    press(w, 'menuUp');
    press(w, 'menuSelect'); // untick 6
    expect(w.run.selectedVeterans).toEqual([5]);
  });

  it('Start brings the ticked veterans first, then generated pilots up to startingSquad, into battle 1', () => {
    const w = startWorld();
    w.tuning.run.startingSquad = 3;
    offerVeterans(w, [veteran(5), veteran(6)]);
    press(w, 'menuSelect'); // tick veteran 5
    press(w, 'menuUp'); // wraps to Start
    press(w, 'menuSelect');
    expect(w.run).toMatchObject({ phase: 'battle', battle: 1, hull: w.tuning.run.playerHull });
    expect(w.pilots.roster.map((p) => p.name).slice(0, 1)).toEqual(['Vet 5']);
    expect(w.pilots.roster[0]).toMatchObject({ veteran: true, kills: 5 });
    expect(w.pilots.roster).toHaveLength(3);
    expect(w.pilots.roster.filter((p) => p.veteran)).toHaveLength(1);
    expect(w.run.selectedVeterans).toEqual([]);
  });

  it('starts with an empty squad when startingSquad is 0 and no veteran is ticked', () => {
    const w = startWorld();
    w.tuning.run.startingSquad = 0;
    press(w, 'menuSelect');
    expect(w.run.phase).toBe('battle');
    expect(w.pilots.roster).toHaveLength(0);
  });
});

describe('a battle', () => {
  function inBattle(seed = 7): World {
    const w = startWorld(seed);
    press(w, 'menuSelect');
    return w;
  }

  it('sends its waves one after another and counts them', () => {
    const w = inBattle();
    expect(w.run).toMatchObject({ battle: 1, wave: 1, waveTotal: 2 });
    expect(w.fighters.filter((f) => f.alive)).toHaveLength(3);
    clearWave(w);
    expect(w.run.wave).toBe(2);
    // Battle 1's last wave: three fighters and one formation wing (the introduction).
    expect(w.fighters.filter((f) => f.alive)).toHaveLength(3 + w.tuning.wings.size);
    expect(w.enemies.wings).toHaveLength(1);
    expect(w.run.battleKills).toBe(3);
  });

  it('the classic ramp sends plain fighter waves instead', () => {
    const w = startWorld();
    w.tuning.run.ramp = 'classic';
    press(w, 'menuSelect');
    clearWave(w);
    expect(w.run.wave).toBe(2);
    expect(w.fighters.filter((f) => f.alive)).toHaveLength(3);
    expect(w.enemies.wings).toHaveLength(0);
  });

  it('has no statics or drones, and turrets only from battle 3', () => {
    const w = inBattle();
    expect(w.targets).toHaveLength(0);
    w.tuning.run.ramp = 'classic';
    w.tuning.run.turretsFromBattle = 1;
    w.tuning.run.turretsBase = 2;
    clearBattle(w);
    press(w, 'menuUp'); // Continue
    press(w, 'menuSelect');
    expect(w.run.battle).toBe(2);
    expect(w.targets.filter((t) => t.kind === 'turret')).toHaveLength(3);
    expect(w.targets.every((t) => t.kind === 'turret')).toBe(true);
  });

  it('clearing the last wave opens the debrief: events, hull restored, three candidates', () => {
    const w = inBattle();
    w.run.hull = 2;
    clearWave(w);
    for (const f of w.fighters) if (f.alive) f.hp = 0;
    stepWorld(w, DT);
    expect(events(w, 'BattleCleared')).toBe(1);
    expect(w.run.phase).toBe('debrief');
    expect(w.run.hull).toBe(w.tuning.run.playerHull);
    expect(w.run.candidates).toHaveLength(3);
    expect(new Set(w.run.candidates.map((c) => c.trait)).size).toBe(3);
    expect(w.pilots.roster.every((p) => p.battles === 1)).toBe(true);
  });

  it('a pick adds one pilot and then only Continue is left; Continue starts the next battle', () => {
    const w = inBattle();
    w.tuning.run.startingSquad = 1;
    w.pilots.roster.length = 0;
    w.pilots.nextId = 1;
    clearBattle(w);
    const first = w.run.candidates[0]!;
    const before = activeCount(w.pilots);
    press(w, 'menuSelect'); // the highlighted candidate
    expect(activeCount(w.pilots)).toBe(before + 1);
    expect(w.pilots.roster.at(-1)).toMatchObject({ name: first.name, trait: first.trait });
    expect(w.run.candidates).toEqual([]);
    expect(menuRows(w.run)).toBe(1);
    press(w, 'menuSelect'); // Continue
    expect(w.run).toMatchObject({ phase: 'battle', battle: 2, wave: 1, battleKills: 0 });
  });

  it('B rests the cursor on Continue so the pick can be skipped', () => {
    const w = inBattle();
    clearBattle(w);
    const count = activeCount(w.pilots);
    press(w, 'menuBack');
    expect(w.run.cursor).toBe(w.run.candidates.length);
    press(w, 'menuSelect');
    expect(w.run.battle).toBe(2);
    expect(activeCount(w.pilots)).toBe(count);
  });

  it('a full squad has nothing to pick: the debrief is only Continue', () => {
    const w = startWorld();
    w.tuning.run.startingSquad = 4;
    press(w, 'menuSelect');
    expect(activeCount(w.pilots)).toBe(4);
    clearBattle(w);
    expect(w.run.phase).toBe('debrief');
    expect(w.run.candidates).toEqual([]);
    expect(menuRows(w.run)).toBe(1);
  });

  it('the next battle restores the squad and puts the ship back at the centre', () => {
    const w = inBattle();
    w.ship.x = 900;
    w.squadron.wingmen[0]!.hp = 0.5;
    clearBattle(w);
    press(w, 'menuBack');
    press(w, 'menuSelect');
    expect(w.run.battle).toBe(2);
    expect(Math.abs(w.ship.x)).toBeLessThan(50);
    stepWorld(w, DT);
    const hps = w.squadron.wingmen.filter((x) => x.alive).map((x) => x.hp);
    expect(hps.length).toBe(activeCount(w.pilots));
    expect(Math.min(...hps)).toBeGreaterThanOrEqual(w.tuning.squadron.health - 1);
  });

  it('a lost pilot stays lost across battles and is counted in the debrief', () => {
    const w = inBattle();
    const doomed = w.pilots.roster[0]!;
    w.squadron.wingmen.find((x) => x.pilotId === doomed.id)!.hp = 0.01;
    const shot = w.enemyShots.spawn();
    const wm = w.squadron.wingmen.find((x) => x.pilotId === doomed.id)!;
    w.enemyShots.data.x[shot] = wm.ship.x;
    w.enemyShots.data.y[shot] = wm.ship.y;
    w.enemyShots.data.life[shot] = 2;
    stepWorld(w, DT);
    expect(doomed.status).toBe('lost');
    expect(w.run.battleLost).toBe(1);
    clearBattle(w);
    expect(w.run.phase).toBe('debrief');
    press(w, 'menuBack');
    press(w, 'menuSelect');
    stepWorld(w, DT);
    expect(w.squadron.wingmen.some((x) => x.pilotId === doomed.id)).toBe(false);
    expect(doomed.status).toBe('lost');
  });
});

describe('hull and defeat', () => {
  function inBattle(): World {
    const w = startWorld();
    press(w, 'menuSelect');
    return w;
  }
  function shootPlayer(w: World): void {
    const k = w.enemyShots.spawn();
    w.enemyShots.data.x[k] = w.ship.x;
    w.enemyShots.data.y[k] = w.ship.y;
    w.enemyShots.data.life[k] = 2;
  }

  it('every enemy bullet that hits takes one hull point', () => {
    const w = inBattle();
    shootPlayer(w);
    stepWorld(w, DT);
    expect(w.run.hull).toBe(w.tuning.run.playerHull - 1);
  });

  it('an evade roll in progress protects the hull', () => {
    const w = inBattle();
    w.actions.evade = true;
    stepWorld(w, DT); // the roll starts
    expect(w.ship.invulnerable).toBe(true);
    shootPlayer(w);
    stepWorld(w, DT);
    expect(w.run.hull).toBe(w.tuning.run.playerHull);
  });

  it('the last hull point ends the run in defeat', () => {
    const w = inBattle();
    w.run.hull = 1;
    shootPlayer(w);
    stepWorld(w, DT);
    expect(w.run).toMatchObject({ phase: 'end', result: 'defeat', hull: 0 });
    expect(events(w, 'RunEnded')).toBe(1);
  });

  it('the end screen restarts into a fresh start screen with new pilots', () => {
    const w = inBattle();
    const firstNames = w.pilots.roster.map((p) => p.name);
    w.run.hull = 1;
    shootPlayer(w);
    stepWorld(w, DT);
    press(w, 'menuSelect');
    expect(w.run).toMatchObject({ phase: 'start', battle: 0, result: 'none' });
    expect(w.pilots.roster).toHaveLength(0);
    press(w, 'menuSelect');
    expect(w.run.battle).toBe(1);
    expect(w.pilots.roster.map((p) => p.name)).not.toEqual(firstNames);
  });
});

describe('victory', () => {
  it('clearing the last battle ends the run in victory', () => {
    const w = startWorld();
    w.tuning.run.battleCount = 2;
    press(w, 'menuSelect');
    clearBattle(w);
    press(w, 'menuBack');
    press(w, 'menuSelect');
    expect(w.run.battle).toBe(2);
    clearBattle(w);
    expect(w.run).toMatchObject({ phase: 'end', result: 'victory' });
    expect(w.pilots.roster.every((p) => p.battles === 2)).toBe(true);
  });
});

describe('practice mode is untouched', () => {
  it('stays in the battle phase and never starts a run by itself', () => {
    const w = createWorld(3, createTuning());
    w.actions.menuSelect = true;
    for (let i = 0; i < 120; i++) stepWorld(w, DT);
    expect(w.run).toMatchObject({ mode: 'practice', phase: 'battle', battle: 0, wave: 0 });
    expect(w.fighters.length).toBeGreaterThan(0); // the practice waves still come
  });
});

describe('replay hash', () => {
  it('covers the offered pilots, the veterans on offer and the ticked ones', () => {
    const w = startWorld();
    offerVeterans(w, [veteran(5)]);
    w.run.candidates = [{ name: 'A B', trait: 'bold' }];
    const base = hashWorld(w);
    const change = (fn: () => void, undo: () => void): void => {
      fn();
      expect(hashWorld(w)).not.toBe(base);
      undo();
      expect(hashWorld(w)).toBe(base);
    };
    change(
      () => (w.run.candidates[0]!.trait = 'steady'),
      () => (w.run.candidates[0]!.trait = 'bold'),
    );
    change(
      () => (w.run.candidates[0]!.name = 'A C'),
      () => (w.run.candidates[0]!.name = 'A B'),
    );
    change(
      () => w.run.candidates.push({ name: 'X Y', trait: 'bold' }),
      () => w.run.candidates.pop(),
    );
    change(
      () => (w.run.available[0]!.id = 9),
      () => (w.run.available[0]!.id = 5),
    );
    change(
      () => (w.run.available[0]!.kills = 77),
      () => (w.run.available[0]!.kills = 5),
    );
    change(
      () => w.run.selectedVeterans.push(5),
      () => w.run.selectedVeterans.pop(),
    );
  });
});

describe('the battle table drives the run', () => {
  const classic = (): ReturnType<typeof createTuning>['run'] => {
    const cfg = createTuning().run;
    cfg.ramp = 'classic';
    return cfg;
  };

  it('the authored ramp differs from the classic one in battles 1 to 3; battle 4 is still the old row (track C replaces it)', () => {
    const authored = createTuning().run;
    for (const n of [1, 2, 3]) {
      expect(battleDefOf(authored, n), `battle ${n}`).not.toEqual(battleDefOf(classic(), n));
    }
    expect(battleDefOf(authored, 4)).toEqual(battleDefOf(classic(), 4));
  });

  it('a battle past the end of the table falls back to the classic formulas', () => {
    const cfg = createTuning().run;
    expect(battleDefOf(cfg, 9).waves).toHaveLength(wavesIn(cfg, 9));
  });

  it('the classic ramp follows the run tuning numbers, the authored one does not', () => {
    const cfg = classic();
    cfg.wavesBase = 5;
    expect(battleDefOf(cfg, 1).waves).toHaveLength(5);
    const authored = createTuning().run;
    authored.wavesBase = 5;
    expect(battleDefOf(authored, 1).waves).toHaveLength(2);
  });

  it('a battle spawns the groups of its table wave and counts its waves from the table', () => {
    const w = startWorld();
    const plan = battleDefOf(w.tuning.run, 1);
    press(w, 'menuSelect'); // Start
    expect(w.run.battle).toBe(1);
    expect(w.run.waveTotal).toBe(plan.waves.length);
    stepWorld(w, DT);
    expect(w.run.wave).toBe(1);
    expect(w.fighters.filter((f) => f.alive)).toHaveLength(plan.waves[0]!.groups[0]!.count);
  });

  it('emits EnemySpawned for each fighter of a wave', () => {
    const w = startWorld();
    const seen: string[] = [];
    const emit = w.events.emit;
    w.events.emit = (e) => {
      if (e.type === 'EnemySpawned') seen.push(e.kind);
      emit(e);
    };
    press(w, 'menuSelect');
    stepWorld(w, DT);
    expect(seen).toEqual(['fighter', 'fighter', 'fighter']);
  });
});
