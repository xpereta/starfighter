import { DEG } from '../../../src/core/math';
import type { EnemyKind } from '../../../src/core/enemies/kinds';
import { gunshipParams } from '../../tuning/gunship';

/** Gunship (spec section 3): slow, tough, two rapid-fire turrets with wide but not all-round arcs. A STUB, not spawned yet. Owned by track A. */
const turret = (id: string, side: 1 | -1) => ({
  id,
  x: -10,
  y: 40 * side,
  arcCenter: (Math.PI / 2) * side,
  arcHalf: gunshipParams.turretArc.default * DEG,
  fireRate: gunshipParams.turretFireRate.default,
  bulletSpeed: 700,
  bulletDamage: 1,
  bulletLife: 1.4,
  range: 900,
  spread: 3 * DEG,
  burst: {
    shots: gunshipParams.turretBurstShots.default,
    pause: gunshipParams.turretBurstPause.default,
  },
});

export const gunshipKind: EnemyKind = {
  id: 'gunship',
  label: 'Gunship',
  hull: 12,
  radius: 70,
  speedScale: 0.35,
  turnScale: 0.3,
  mounts: [turret('turret-left', 1), turret('turret-right', -1)],
  ai: 'gunship',
  threat: 4,
  fromBattle: 2,
};
