import { describe, expect, it } from 'vitest';
import { createActions } from '../core/world/actions';
import { maskFlightActions, menuEdges, moveCursor, stepMenuNav } from './menu-nav';

const flags = (over: Partial<ReturnType<typeof createActions>> = {}) => ({
  ...createActions(),
  ...over,
});

describe('menuEdges', () => {
  it('a button counts only on the step it goes down, not while held', () => {
    const none = flags();
    const down = flags({ menuDown: true });
    expect(menuEdges(down, none).down).toBe(true);
    expect(menuEdges(down, down).down).toBe(false); // held
    expect(menuEdges(none, down).down).toBe(false); // released
  });

  it('tracks the four buttons independently', () => {
    const e = menuEdges(flags({ menuUp: true, menuSelect: true }), flags({ menuSelect: true }));
    expect(e).toEqual({ up: true, down: false, select: false, back: false });
  });
});

describe('moveCursor', () => {
  it('moves one item per press and wraps around both ends', () => {
    expect(moveCursor(0, 3, false, true)).toBe(1);
    expect(moveCursor(2, 3, false, true)).toBe(0); // down from the last wraps to the first
    expect(moveCursor(0, 3, true, false)).toBe(2); // up from the first wraps to the last
    expect(moveCursor(1, 3, true, false)).toBe(0);
  });

  it('does nothing with no press, or with up and down together', () => {
    expect(moveCursor(1, 3, false, false)).toBe(1);
    expect(moveCursor(1, 3, true, true)).toBe(1);
  });

  it('stays inside the list for bad cursors and tiny lists', () => {
    expect(moveCursor(99, 3, false, false)).toBe(2);
    expect(moveCursor(-5, 3, false, false)).toBe(0);
    expect(moveCursor(NaN, 3, false, false)).toBe(0);
    expect(moveCursor(0, 1, false, true)).toBe(0);
    expect(moveCursor(0, 1, true, false)).toBe(0);
    expect(moveCursor(4, 0, false, true)).toBe(0);
  });
});

describe('stepMenuNav', () => {
  it('moves, selects and goes back only on fresh presses', () => {
    const idle = flags();
    expect(stepMenuNav(0, 3, flags({ menuDown: true }), idle)).toEqual({
      cursor: 1,
      select: false,
      back: false,
    });
    expect(stepMenuNav(1, 3, flags({ menuSelect: true }), idle)).toEqual({
      cursor: 1,
      select: true,
      back: false,
    });
    expect(stepMenuNav(1, 3, flags({ menuBack: true }), idle)).toEqual({
      cursor: 1,
      select: false,
      back: true,
    });
    const held = flags({ menuSelect: true });
    expect(stepMenuNav(1, 3, held, held).select).toBe(false);
  });

  it('a stick held down walks the list once per press, not every frame', () => {
    let cursor = 0;
    let prev = flags();
    for (let i = 0; i < 30; i++) {
      const now = flags({ menuDown: true });
      cursor = stepMenuNav(cursor, 4, now, prev).cursor;
      prev = now;
    }
    expect(cursor).toBe(1);
  });
});

describe('maskFlightActions', () => {
  it('clears every flight control and keeps the menu buttons', () => {
    const a = flags({
      steerX: 1,
      steerY: -1,
      rotate: 1,
      throttle: 1,
      fire: true,
      evade: true,
      respawn: true,
      startTrial: true,
      launch: true,
      attackOrder: true,
      cycleFormation: true,
      menuUp: true,
      menuDown: true,
      menuSelect: true,
      menuBack: true,
    });
    maskFlightActions(a);
    expect(a).toEqual({
      ...createActions(),
      menuUp: true,
      menuDown: true,
      menuSelect: true,
      menuBack: true,
    });
  });
});
