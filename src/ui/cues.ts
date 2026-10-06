import { wingCue } from '../core/ai/wings';
import type { World } from '../core/world/world';

/**
 * The text cue to show at the top of the battle HUD, or null (prototype 5, spec section 8). Read-only
 * state, so it works with every style. Other enemy types add their cue here (missile warning,
 * capital ship) in the order they should win.
 */
export function cueText(world: World): string | null {
  return wingCue(world);
}
