import type { SlotAnchor, SquadronConfig } from '../../../data/tuning/squadron';
import type { Point } from '../ai/steering';
import { TAU } from '../math';
import type { Formation } from './squadron';

/**
 * Layout proportions of the tight formation (the shape; the size is `tightRadius`): wingmen pair up
 * behind-left and behind-right, and each further pair sits a little further back and out.
 */
const TIGHT_BACK_BASE = 0.5; // first pair: this fraction of tightRadius behind the player
const TIGHT_BACK_STEP = 0.75; // each further pair: this much further back
const TIGHT_SIDE_BASE = 0.7; // first pair: this fraction of tightRadius to the side
const TIGHT_SIDE_STEP = 0.6; // each further pair: this much further out
// These steps keep neighbouring slots further apart than the default separation distance.

/** Below this speed (u/s) the velocity has no usable direction, so the nose is used instead. */
const MIN_ANCHOR_SPEED = 1;

/**
 * The frame the formation is built in: the player's position and a heading. With the `velocity`
 * anchor the heading is the direction of travel (steady through hard turns), with `nose` it is the
 * ship's heading. Fills `out`.
 */
export function slotFrame(
  out: { x: number; y: number; heading: number },
  player: { x: number; y: number; heading: number; vx: number; vy: number },
  anchor: SlotAnchor,
): { x: number; y: number; heading: number } {
  out.x = player.x;
  out.y = player.y;
  const moving = Math.hypot(player.vx, player.vy) > MIN_ANCHOR_SPEED;
  out.heading = anchor === 'velocity' && moving ? Math.atan2(player.vy, player.vx) : player.heading;
  return out;
}

/**
 * Where wingman `index` (of `count`) should be, as a point fixed to the player.
 * - tight: behind the frame's heading (see `slotFrame`), alternating left and right (index 0 is left), stacking back;
 * - spread: evenly around a ring of `spreadRadius` at fixed world angles (index 0 is due east).
 * The slot moves with the player, so a wingman that holds it flies the player's velocity.
 */
export function slotPosition(
  out: Point,
  formation: Formation,
  index: number,
  count: number,
  player: { x: number; y: number; heading: number },
  cfg: Pick<SquadronConfig, 'tightRadius' | 'spreadRadius'>,
): Point {
  if (formation === 'spread') {
    const angle = (TAU * index) / Math.max(count, 1);
    out.x = player.x + Math.cos(angle) * cfg.spreadRadius;
    out.y = player.y + Math.sin(angle) * cfg.spreadRadius;
    return out;
  }
  const rank = Math.floor(index / 2);
  const side = index % 2 === 0 ? 1 : -1; // +1 = left of the nose
  const back = cfg.tightRadius * (TIGHT_BACK_BASE + TIGHT_BACK_STEP * rank);
  const lateral = cfg.tightRadius * (TIGHT_SIDE_BASE + TIGHT_SIDE_STEP * rank) * side;
  const fx = Math.cos(player.heading);
  const fy = Math.sin(player.heading);
  out.x = player.x - fx * back - fy * lateral;
  out.y = player.y - fy * back + fx * lateral;
  return out;
}
