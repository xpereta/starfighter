import { wrapAngle } from '../math';
import { stepSeconds } from '../world/clock';
import { FIGHTER_ID_BASE } from '../world/lockable';
import type { World } from '../world/world';
import { livingWingmen, type Squadron } from './squadron';
import { bodyOf } from './wingmen';

/**
 * The enemy closest to where the player's nose points (smallest angle to the nose), within `range`.
 * Fighters, drones and turrets count; static targets are only practice dummies. Returns a lockable
 * id (see core/world/lockable.ts), or -1 when there is nothing.
 */
export function nearestToNose(world: World, range: number): number {
  const { x, y, heading } = world.ship;
  let best = -1;
  let bestAngle = Infinity;
  const consider = (id: number, cx: number, cy: number): void => {
    const dx = cx - x;
    const dy = cy - y;
    if (dx * dx + dy * dy > range * range) return;
    const angle = Math.abs(wrapAngle(Math.atan2(dy, dx) - heading));
    if (angle < bestAngle) {
      best = id;
      bestAngle = angle;
    }
  };
  world.fighters.forEach((f, i) => {
    if (f.alive) consider(FIGHTER_ID_BASE + i, f.x, f.y);
  });
  world.targets.forEach((t, i) => {
    if (t.alive && t.kind !== 'static') consider(i, t.x, t.y);
  });
  return best;
}

/** What "attack my target" aims at: the player's first lock, else the enemy nearest the nose, else -1. */
export function attackTarget(world: World): number {
  const first = world.lockon.locks[0];
  if (first !== undefined) {
    const body = bodyOf(world, first);
    if (body && body.alive) return first;
  }
  return nearestToNose(world, world.tuning.squadron.attackSearchRange);
}

function endOrder(squadron: Squadron): void {
  squadron.order = 'none';
  squadron.orderTimer = 0;
  squadron.orderTargetId = -1;
}

/**
 * The two squadron orders (spec section 5), both edge-triggered (`world.prev` still holds last
 * step's buttons here: it is updated at the end of the step):
 * - cycle formation (LB / Q): tight <-> spread, announced with `OrderGiven{tight | spread}`;
 * - attack my target (RB / F): every wingman goes for the target picked when the order is given
 *   (see `attackTarget`) for `attackOrderTime`. It ends early when the target dies; a second press
 *   cancels it (announced as `OrderGiven` with the formation they return to). With no living
 *   wingman, or nothing to aim at, the press does nothing.
 */
export function stepOrders(world: World): void {
  const sq = world.squadron;
  const { actions, prev } = world;

  if (actions.cycleFormation && !prev.cycleFormation) {
    sq.formation = sq.formation === 'tight' ? 'spread' : 'tight';
    world.events.emit({ type: 'OrderGiven', order: sq.formation });
  }

  if (actions.attackOrder && !prev.attackOrder) {
    if (sq.order === 'attack') {
      endOrder(sq);
      world.events.emit({ type: 'OrderGiven', order: sq.formation });
    } else if (livingWingmen(sq) > 0) {
      const target = attackTarget(world);
      if (target >= 0) {
        sq.order = 'attack';
        sq.orderTargetId = target;
        sq.orderTimer = world.tuning.squadron.attackOrderTime;
        world.events.emit({ type: 'OrderGiven', order: 'attack' });
      }
    }
  }

  if (sq.order === 'attack') {
    sq.orderTimer -= stepSeconds(world);
    const body = bodyOf(world, sq.orderTargetId);
    if (sq.orderTimer <= 0 || !body || !body.alive) endOrder(sq);
  }
}
