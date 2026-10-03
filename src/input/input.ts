import { inputTuning } from '../../data/tuning/input';
import type { Actions } from '../core/world/actions';
import { mapGamepad, mapKeyboard, mergeActions, type GamepadSnapshot } from './mapping';

const HANDLED = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'KeyR',
  'KeyT',
  'Space',
  'ShiftLeft',
  'ShiftRight',
]);

export interface Input {
  /** Samples keyboard + first connected standard gamepad into `out`. Call once per frame. */
  poll(out: Actions): void;
  dispose(): void;
}

/** Browser wiring only; all mapping logic lives in mapping.ts. */
export function createInput(): Input {
  const held = new Set<string>();
  const onDown = (e: KeyboardEvent): void => {
    if (HANDLED.has(e.code)) {
      held.add(e.code);
      e.preventDefault();
    }
  };
  const onUp = (e: KeyboardEvent): void => {
    held.delete(e.code);
  };
  // Releasing keys while the window is unfocused would otherwise leave them stuck.
  const onBlur = (): void => held.clear();
  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup', onUp);
  window.addEventListener('blur', onBlur);

  function firstPad(): GamepadSnapshot | null {
    for (const pad of navigator.getGamepads?.() ?? []) {
      if (pad && pad.connected && pad.mapping === 'standard') return pad;
    }
    return null;
  }

  return {
    poll(out) {
      const keys = mapKeyboard(held);
      const pad = firstPad();
      Object.assign(
        out,
        pad ? mergeActions(keys, mapGamepad(pad, inputTuning.stickDeadzone)) : keys,
      );
    },
    dispose() {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
    },
  };
}
