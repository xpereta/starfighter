import type { Actions } from '../core/world/actions';

/**
 * While a menu is up the keys that fly the ship must not act. The run itself reads the `menu*`
 * actions (edge-triggered against `world.prev`, see `stepRun`), so this only masks the flight ones.
 */

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
