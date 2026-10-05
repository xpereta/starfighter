import type { FighterConfig } from '../../../data/tuning/fighter';

/** What a fighter decided about a missile homing on it (stored in `Fighter.missilePlan`). */
export const PLAN_IGNORE = 0;
export const PLAN_REACT = 1;
export const PLAN_DONE = 2;

/**
 * Chance that a fighter reacts to a missile first noticed `distance` away: `missileEvadeChance`,
 * reduced by `missileFarPenalty` the nearer that distance is to the edge of `missileDetectRange`.
 */
export function awarenessChance(cfg: FighterConfig, distance: number): number {
  const far = Math.min(1, Math.max(0, distance / cfg.missileDetectRange));
  return cfg.missileEvadeChance * (1 - cfg.missileFarPenalty * far);
}

/**
 * The time to impact at or below which the fighter rolls. The ideal moment is the middle of the
 * roll's invulnerability window (so the missile arrives while it is immune); `error` (seconds,
 * drawn from +-`missileReactionError`) shifts it earlier (missile arrives after the i-frames end)
 * or later (missile arrives before the roll starts).
 */
export function reactionTrigger(evadeIFrames: number, error: number): number {
  return evadeIFrames / 2 + error;
}

/**
 * Estimated seconds until a missile reaches a fighter: the distance over the closing speed along
 * the line between them. Infinity when it is not closing in. A rough estimate (it ignores the
 * missile's acceleration and turning), which is part of why some rolls are mistimed.
 */
export function timeToImpact(dx: number, dy: number, relVx: number, relVy: number): number {
  const dist = Math.hypot(dx, dy);
  if (dist <= 0) return 0;
  const closing = -(dx * relVx + dy * relVy) / dist;
  return closing > 1e-6 ? dist / closing : Infinity;
}
