import { describe, expect, it } from 'vitest';
import { createActions } from '../core/world/actions';
import { applyDeadzone, mapGamepad, mapKeyboard, mapPause, mergeActions } from './mapping';

const pad = (axes: number[], pressed: Record<number, number> = {}) => ({
  axes,
  buttons: Array.from({ length: 16 }, (_, i) => ({
    value: pressed[i] ?? 0,
    pressed: (pressed[i] ?? 0) > 0.5,
  })),
});

describe('applyDeadzone', () => {
  it('zeroes small input', () => {
    expect(applyDeadzone(0.1, 0.05, 0.15)).toEqual([0, 0]);
  });

  it('rescales so full travel is still 1 and keeps direction', () => {
    const [x, y] = applyDeadzone(1, 0, 0.2);
    expect(x).toBeCloseTo(1);
    expect(y).toBe(0);
    const [dx, dy] = applyDeadzone(0.3, 0.4, 0.2);
    expect(Math.hypot(dx, dy)).toBeCloseTo(0.375);
    expect(dx / dy).toBeCloseTo(0.75);
  });

  it('clamps diagonal overshoot to 1', () => {
    const [x, y] = applyDeadzone(1, 1, 0.1);
    expect(Math.hypot(x, y)).toBeCloseTo(1);
  });
});

describe('mapGamepad', () => {
  it('inverts stick y and applies the deadzone', () => {
    const a = mapGamepad(pad([0, -1]), 0.15);
    expect(a.steerY).toBeCloseTo(1);
    expect(mapGamepad(pad([0.05, 0.05]), 0.15)).toEqual(createActions());
  });

  it('maps triggers to signed throttle and buttons to fire/evade', () => {
    const a = mapGamepad(pad([0, 0], { 7: 1, 0: 1, 2: 1 }), 0.15);
    expect(a.throttle).toBeCloseTo(1);
    expect(a.fire && a.evade).toBe(true);
    expect(mapGamepad(pad([0, 0], { 6: 1 }), 0.15).throttle).toBeCloseTo(-1);
  });

  it('tolerates a short snapshot', () => {
    expect(mapGamepad({ axes: [], buttons: [] }, 0.15)).toEqual(createActions());
  });
});

describe('mapKeyboard', () => {
  it('maps WASD, arrows, space and shift', () => {
    expect(mapKeyboard(new Set(['KeyW', 'KeyD', 'Space', 'ShiftLeft']))).toEqual({
      steerX: 0,
      steerY: 0,
      rotate: 1,
      throttle: 1,
      fire: true,
      evade: true,
      respawn: false,
      startTrial: false,
      launch: false,
      attackOrder: false,
      cycleFormation: false,
      menuUp: true,
      menuDown: false,
      menuSelect: true,
      menuBack: false,
    });
    expect(mapKeyboard(new Set(['ArrowLeft', 'ArrowDown'])).rotate).toBe(-1);
  });

  it('cancels opposite keys held together', () => {
    const a = mapKeyboard(new Set(['KeyA', 'KeyD', 'KeyW', 'KeyS']));
    expect(a.rotate).toBe(0);
    expect(a.throttle).toBe(0);
  });

  it('maps R to respawn and T to start the trial', () => {
    const a = mapKeyboard(new Set(['KeyR', 'KeyT']));
    expect(a.respawn && a.startTrial).toBe(true);
    const p = mapGamepad(pad([0, 0], { 3: 1, 9: 1 }), 0.15);
    expect(p.respawn && p.startTrial).toBe(true);
  });

  it('maps E to launch, F to attack order and Q to cycle formation (B, RB, LB on a pad)', () => {
    const k = mapKeyboard(new Set(['KeyE', 'KeyF', 'KeyQ']));
    expect([k.launch, k.attackOrder, k.cycleFormation]).toEqual([true, true, true]);
    const p = mapGamepad(pad([0, 0], { 1: 1, 5: 1, 4: 1 }), 0.15);
    expect([p.launch, p.attackOrder, p.cycleFormation]).toEqual([true, true, true]);
    const none = mapKeyboard(new Set(['KeyW']));
    expect([none.launch, none.attackOrder, none.cycleFormation]).toEqual([false, false, false]);
  });

  it('maps the menu controls: arrows/W/S, Enter/Space, Esc/Backspace; D-pad or stick, A, B on a pad', () => {
    const k = mapKeyboard(new Set(['ArrowUp', 'Enter', 'Escape']));
    expect([k.menuUp, k.menuDown, k.menuSelect, k.menuBack]).toEqual([true, false, true, true]);
    const k2 = mapKeyboard(new Set(['KeyS', 'Space', 'Backspace']));
    expect([k2.menuUp, k2.menuDown, k2.menuSelect, k2.menuBack]).toEqual([false, true, true, true]);
    const dpad = mapGamepad(pad([0, 0], { 12: 1 }), 0.15);
    expect([dpad.menuUp, dpad.menuDown]).toEqual([true, false]);
    expect(mapGamepad(pad([0, 0], { 13: 1 }), 0.15).menuDown).toBe(true);
    expect(mapGamepad(pad([0, -0.9]), 0.15).menuUp).toBe(true); // stick pushed up (gamepad y is negative up)
    expect(mapGamepad(pad([0, 0.9]), 0.15).menuDown).toBe(true);
    expect(mapGamepad(pad([0, -0.3]), 0.15).menuUp).toBe(false); // a gentle push is not a menu press
    const ab = mapGamepad(pad([0, 0], { 0: 1, 1: 1 }), 0.15);
    expect([ab.menuSelect, ab.menuBack]).toEqual([true, true]);
  });

  it('gives neutral actions with nothing pressed', () => {
    expect(mapKeyboard(new Set())).toEqual(createActions());
  });
});

describe('mergeActions', () => {
  it('takes the larger magnitude per axis and ORs buttons', () => {
    const a = { ...createActions(), steerX: -0.8, throttle: 0.2, fire: true };
    const b = { ...createActions(), steerX: 0.3, throttle: -0.9, evade: true };
    expect(mergeActions(a, b)).toEqual({
      steerX: -0.8,
      steerY: 0,
      rotate: 0,
      throttle: -0.9,
      fire: true,
      evade: true,
      respawn: false,
      startTrial: false,
      launch: false,
      attackOrder: false,
      cycleFormation: false,
      menuUp: false,
      menuDown: false,
      menuSelect: false,
      menuBack: false,
    });
  });
});

describe('mapPause', () => {
  it('P, Escape and pad Start pause; flight keys do not', () => {
    expect(mapPause(new Set(['KeyP']), null)).toBe(true);
    expect(mapPause(new Set(['Escape']), null)).toBe(true);
    expect(mapPause(new Set(), pad([0, 0], { 9: 1 }))).toBe(true);
    expect(mapPause(new Set(['KeyW', 'Space', 'KeyT']), pad([0, 0], { 0: 1 }))).toBe(false);
  });

  it('is not part of the recorded actions', () => {
    expect('pause' in mapKeyboard(new Set(['KeyP']))).toBe(false);
  });
});
