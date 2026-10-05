import { inputTuning } from '../../data/tuning/input';
import type { Actions } from '../core/world/actions';
import { mapGamepad, mapKeyboard, mapPause, mergeActions, type GamepadSnapshot } from './mapping';

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
  'KeyE',
  'KeyF',
  'KeyQ',
  'KeyP',
  'Enter',
  'Escape',
  'Backspace',
  'Space',
  'ShiftLeft',
  'ShiftRight',
]);

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export interface Input {
  /** Samples keyboard + first connected standard gamepad into `out`. Call once per frame. */
  poll(out: Actions): void;
  /** True when a pause button (P, Escape, pad Start) is held as of the last poll. Not an action. */
  readonly pause: boolean;
  dispose(): void;
}

/** Browser wiring only; all mapping logic lives in mapping.ts. */
export function createInput(): Input {
  const held = new Set<string>();
  // Keys pressed since the last poll: a tap shorter than one frame must still register.
  const tapped = new Set<string>();
  const sampled = new Set<string>();
  const onDown = (e: KeyboardEvent): void => {
    if (isTyping(e.target)) return; // the tuning panel has text fields
    if (HANDLED.has(e.code)) {
      held.add(e.code);
      tapped.add(e.code);
      e.preventDefault();
    }
  };
  const onUp = (e: KeyboardEvent): void => {
    held.delete(e.code);
  };
  // Releasing keys while the window is unfocused would otherwise leave them stuck.
  const onBlur = (): void => {
    held.clear();
    tapped.clear();
  };
  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup', onUp);
  window.addEventListener('blur', onBlur);

  function firstPad(): GamepadSnapshot | null {
    for (const pad of navigator.getGamepads?.() ?? []) {
      if (pad && pad.connected && pad.mapping === 'standard') return pad;
    }
    return null;
  }

  let pause = false;
  return {
    get pause() {
      return pause;
    },
    poll(out) {
      sampled.clear();
      for (const code of held) sampled.add(code);
      for (const code of tapped) sampled.add(code);
      tapped.clear();
      const keys = mapKeyboard(sampled);
      const pad = firstPad();
      pause = mapPause(sampled, pad);
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
