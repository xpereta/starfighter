import { createActions, type Actions } from '../core/world/actions';

/** Structural subset of the browser Gamepad, so mapping stays pure and testable in Node. */
export interface GamepadSnapshot {
  readonly axes: readonly number[];
  readonly buttons: readonly { readonly value: number; readonly pressed: boolean }[];
}

/** Standard-mapping indices: A = 0, X = 2, LT = 6, RT = 7, left stick = axes 0/1. */
const BTN_FIRE = 0;
const BTN_EVADE = 2;
const BTN_LT = 6;
const BTN_RT = 7;

/** Radial deadzone: zero inside `deadzone`, rescaled so the output still reaches 1 at full travel. */
export function applyDeadzone(x: number, y: number, deadzone: number): [number, number] {
  const mag = Math.hypot(x, y);
  if (mag <= deadzone || mag === 0) return [0, 0];
  const scaled = Math.min(1, (mag - deadzone) / (1 - deadzone));
  return [(x / mag) * scaled, (y / mag) * scaled];
}

function trigger(pad: GamepadSnapshot, index: number, deadzone: number): number {
  const v = pad.buttons[index]?.value ?? 0;
  return v <= deadzone ? 0 : (v - deadzone) / (1 - deadzone);
}

export function mapGamepad(pad: GamepadSnapshot, deadzone: number): Actions {
  const [steerX, steerYDown] = applyDeadzone(pad.axes[0] ?? 0, pad.axes[1] ?? 0, deadzone);
  return {
    steerX,
    steerY: -steerYDown || 0, // gamepad y points down; world y is up
    throttle: trigger(pad, BTN_RT, deadzone) - trigger(pad, BTN_LT, deadzone),
    fire: pad.buttons[BTN_FIRE]?.pressed ?? false,
    evade: pad.buttons[BTN_EVADE]?.pressed ?? false,
  };
}

/** `codes` are `KeyboardEvent.code` values currently held. Opposite keys cancel out. */
export function mapKeyboard(codes: ReadonlySet<string>): Actions {
  const axis = (neg: string[], pos: string[]): number =>
    (pos.some((c) => codes.has(c)) ? 1 : 0) - (neg.some((c) => codes.has(c)) ? 1 : 0);
  return {
    steerX: axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']),
    steerY: 0,
    throttle: axis(['KeyS', 'ArrowDown'], ['KeyW', 'ArrowUp']),
    fire: codes.has('Space'),
    evade: codes.has('ShiftLeft') || codes.has('ShiftRight'),
  };
}

const larger = (a: number, b: number): number => (Math.abs(a) >= Math.abs(b) ? a : b);

/** Combines two input sources: larger magnitude wins per axis, buttons OR together. */
export function mergeActions(a: Actions, b: Actions): Actions {
  return {
    steerX: larger(a.steerX, b.steerX),
    steerY: larger(a.steerY, b.steerY),
    throttle: larger(a.throttle, b.throttle),
    fire: a.fire || b.fire,
    evade: a.evade || b.evade,
  };
}

export { createActions };
