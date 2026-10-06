import { DEG } from '../../../src/core/math';
import type { EnemyKind } from '../../../src/core/enemies/kinds';
import type { WeaponMount } from '../../../src/core/enemies/mounts';
import { gunshipParams } from '../../tuning/gunship';

/**
 * Gunship (spec section 3): slow, tough, two independent rapid-fire turrets with wide but not
 * all-round arcs (a blind wedge straight behind). The numbers are the `gunship` tuning defaults;
 * the live tuning (`world.tuning.gunship`) overrides them at spawn and while firing, so the panel
 * edits take effect. Owned by track A.
 */
const turret = (id: string, side: 1 | -1): WeaponMount => ({
  id,
  x: -10,
  y: 40 * side,
  arcCenter: gunshipParams.turretArcCenter.default * DEG * side,
  arcHalf: gunshipParams.turretArc.default * DEG,
  fireRate: gunshipParams.turretFireRate.default,
  bulletSpeed: gunshipParams.turretBulletSpeed.default,
  bulletDamage: 1,
  bulletLife: gunshipParams.turretBulletLife.default,
  range: gunshipParams.turretRange.default,
  spread: gunshipParams.turretSpread.default * DEG,
  burst: {
    shots: gunshipParams.turretBurstShots.default,
    pause: gunshipParams.turretBurstPause.default,
  },
});

export const gunshipKind: EnemyKind = {
  id: 'gunship',
  label: 'Gunship',
  hull: gunshipParams.hull.default,
  radius: gunshipParams.radius.default,
  speedScale: gunshipParams.speedScale.default,
  turnScale: gunshipParams.turnRateScale.default,
  mounts: [turret('turret-left', 1), turret('turret-right', -1)],
  ai: 'gunship',
  threat: 4,
  fromBattle: 2,
};
