import { DEG } from '../../../src/core/math';
import type { EnemyKind } from '../../../src/core/enemies/kinds';
import { fighterParams } from '../../tuning/fighter';

/**
 * The existing enemy fighter as a kind. Its numbers are the `fighter` tuning defaults (the one
 * source of truth: the live tuning still drives fighter behaviour until track A moves spawning to
 * kinds), so nothing changes. Owned by track A.
 */
export const fighterKind: EnemyKind = {
  id: 'fighter',
  label: 'Fighter',
  hull: fighterParams.health.default,
  radius: fighterParams.radius.default,
  speedScale: fighterParams.speedScale.default,
  turnScale: fighterParams.turnRateScale.default,
  mounts: [
    {
      id: 'nose',
      x: fighterParams.muzzleOffset.default,
      y: 0,
      arcCenter: 0,
      arcHalf: fighterParams.fireCone.default * DEG,
      fireRate: fighterParams.fireRate.default,
      bulletSpeed: fighterParams.bulletSpeed.default,
      bulletDamage: 1,
      bulletLife: fighterParams.bulletLife.default,
      range: fighterParams.fireRange.default,
      spread: fighterParams.spread.default * DEG,
      burst: { shots: 1, pause: 0 },
    },
  ],
  ai: 'fighter',
  threat: 1,
  fromBattle: 1,
};
