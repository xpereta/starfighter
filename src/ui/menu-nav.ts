import type { Actions } from '../core/world/actions';

/**
 * Menu navigation semantics (spec section 5), pure and tested. The game only ever changes through
 * the `menu*` actions, which the run consumes edge-triggered against `world.prev`; these helpers
 * are the reference for how a press moves the highlight and which presses count, and they mask
 * the flight controls while a menu is up.
 */

export interface MenuButtons {
  up: boolean;
  down: boolean;
  select: boolean;
  back: boolean;
}

type MenuFlags = Pick<Actions, 'menuUp' | 'menuDown' | 'menuSelect' | 'menuBack'>;

/** Which menu buttons are freshly pressed: down now, not down last step (holding does not repeat). */
export function menuEdges(now: MenuFlags, prev: MenuFlags): MenuButtons {
  return {
    up: now.menuUp && !prev.menuUp,
    down: now.menuDown && !prev.menuDown,
    select: now.menuSelect && !prev.menuSelect,
    back: now.menuBack && !prev.menuBack,
  };
}

/** Moves the highlight one item, wrapping around the ends; up and down together cancel out. */
export function moveCursor(cursor: number, count: number, up: boolean, down: boolean): number {
  if (count <= 0) return 0;
  const clamped = Math.max(0, Math.min(count - 1, Math.round(cursor) || 0));
  const delta = (down ? 1 : 0) - (up ? 1 : 0);
  return (((clamped + delta) % count) + count) % count;
}

export interface NavResult {
  cursor: number;
  /** The highlighted item was confirmed this step. */
  select: boolean;
  /** Back was pressed this step. */
  back: boolean;
}

/** One step of menu input: the new highlight plus whether select or back was pressed. */
export function stepMenuNav(
  cursor: number,
  count: number,
  now: MenuFlags,
  prev: MenuFlags,
): NavResult {
  const e = menuEdges(now, prev);
  return { cursor: moveCursor(cursor, count, e.up, e.down), select: e.select, back: e.back };
}

/**
 * Clears the flight controls (steering, throttle, guns, evade, launch, orders, respawn, trial) and
 * keeps the menu buttons, so the same keys that fly the ship never act behind a menu.
 */
export function maskFlightActions(actions: Actions): void {
  actions.steerX = 0;
  actions.steerY = 0;
  actions.rotate = 0;
  actions.throttle = 0;
  actions.fire = false;
  actions.evade = false;
  actions.respawn = false;
  actions.startTrial = false;
  actions.launch = false;
  actions.attackOrder = false;
  actions.cycleFormation = false;
}
