import { describe, expect, it } from 'vitest';
import { createTuning } from '../../../data/tuning';
import { hashWorld } from '../replay/hash';
import { enterStartScreen, offerVeterans } from '../run/run';
import { createWorld, stepWorld, type World } from '../world/world';
import type { GameEvent } from './events';

/** The events added for sound (prototype 4): where each is emitted, and that none of them is state. */
const DT = 1 / 60;
type Button = 'menuUp' | 'menuDown' | 'menuSelect' | 'menuBack';

const types = (w: World): string[] => w.events.events.map((e) => e.type);
const find = <T extends GameEvent['type']>(w: World, type: T) =>
  w.events.events.find((e) => e.type === type) as Extract<GameEvent, { type: T }> | undefined;

/** Presses a menu button for one step (the events of that step are left in the queue), then lets go. */
function press(w: World, button: Button): GameEvent[] {
  w.actions[button] = true;
  stepWorld(w, DT);
  const seen = [...w.events.events];
  w.actions[button] = false;
  stepWorld(w, DT);
  return seen;
}

function startWorld(): World {
  const w = createWorld(7, createTuning());
  enterStartScreen(w);
  return w;
}

describe('arena edge', () => {
  it('says when the ship goes out of the arena and when it comes back, once each', () => {
    const w = createWorld(1, createTuning());
    w.ship.x = w.tuning.flight.arenaRadius + 50;
    stepWorld(w, DT);
    expect(types(w)).toContain('ArenaEdgeEntered');
    stepWorld(w, DT);
    expect(types(w)).not.toContain('ArenaEdgeEntered'); // still outside: no new event
    w.ship.x = 0;
    w.ship.y = 0;
    stepWorld(w, DT);
    expect(types(w)).toContain('ArenaEdgeLeft');
  });
});

describe('respawn', () => {
  it('emits PlayerRespawned in practice mode', () => {
    const w = createWorld(1, createTuning());
    w.actions.respawn = true;
    stepWorld(w, DT);
    expect(types(w)).toContain('PlayerRespawned');
  });
});

describe('player damage', () => {
  it('an enemy bullet that reaches the player emits PlayerDamaged next to Hit', () => {
    const w = createWorld(1, createTuning());
    w.targets.length = 0;
    const k = w.enemyShots.spawn();
    w.enemyShots.data.x[k] = w.ship.x;
    w.enemyShots.data.y[k] = w.ship.y;
    w.enemyShots.data.vx[k] = 1;
    w.enemyShots.data.life[k] = 2;
    stepWorld(w, DT);
    expect(types(w)).toContain('Hit');
    expect(find(w, 'PlayerDamaged')).toMatchObject({ x: w.ship.x, y: w.ship.y });
  });

  it('in a run the event carries the hull that is left', () => {
    const w = startWorld();
    press(w, 'menuSelect'); // start the run: battle 1
    w.targets.length = 0;
    const before = w.run.hull;
    const k = w.enemyShots.spawn();
    w.enemyShots.data.x[k] = w.ship.x;
    w.enemyShots.data.y[k] = w.ship.y;
    w.enemyShots.data.vx[k] = 1;
    w.enemyShots.data.life[k] = 2;
    stepWorld(w, DT);
    expect(find(w, 'PlayerDamaged')?.hull).toBe(before - 1);
  });
});

describe('menus', () => {
  it('moving the cursor says which way, and wraps without a second event', () => {
    const w = startWorld();
    expect(press(w, 'menuDown')).toContainEqual({ type: 'MenuMove', dir: 1 });
    expect(press(w, 'menuUp')).toContainEqual({ type: 'MenuMove', dir: -1 });
  });

  it('ticking and unticking a veteran says which', () => {
    const w = startWorld();
    w.tuning.pilots.veteransPerRun = 2;
    offerVeterans(w, [{ id: 5, name: 'Ace', trait: 'steady', kills: 3, veteran: true }]);
    expect(press(w, 'menuSelect')).toContainEqual({ type: 'MenuTick', checked: true });
    expect(press(w, 'menuSelect')).toContainEqual({ type: 'MenuTick', checked: false });
  });

  it('Start emits MenuSelect', () => {
    const w = startWorld();
    expect(press(w, 'menuSelect').map((e) => e.type)).toContain('MenuSelect');
  });
});

describe('events are not state', () => {
  it('the hash of a world does not depend on what was emitted: two worlds, one emitting extra events by hand', () => {
    const a = createWorld(3, createTuning());
    const b = createWorld(3, createTuning());
    for (let i = 0; i < 120; i++) {
      a.actions.fire = i % 3 === 0;
      b.actions.fire = i % 3 === 0;
      stepWorld(a, DT);
      b.events.emit({ type: 'PlayerRespawned' });
      b.events.emit({ type: 'MenuTick', checked: true });
      stepWorld(b, DT);
    }
    expect(hashWorld(b)).toBe(hashWorld(a));
  });
});
