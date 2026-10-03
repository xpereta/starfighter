import { defaultsOf, type ParamDef } from '../../src/core/params/params';

/** Gun tuning. Units: world units (u), seconds (s), degrees here (radians inside core). */
export const weaponsParams = {
  fireRate: { default: 12, min: 3, max: 30, unit: 'shots/s' },
  bulletSpeed: { default: 900, min: 300, max: 1800, unit: 'u/s (added to ship velocity)' },
  bulletLife: { default: 0.9, min: 0.3, max: 2, unit: 's' },
  spread: { default: 0.6, min: 0, max: 5, unit: '° (max deviation)' },
  bulletRadius: { default: 6, min: 1, max: 30, unit: 'u' },
  bulletDamage: { default: 1, min: 1, max: 10, unit: 'hp' },
  hitImpulse: { default: 1, min: 0, max: 10, unit: 'impulse (hit nudge / FX strength)' },
  barrelOffset: { default: 14, min: 0, max: 60, unit: 'u (sideways, alternating)' },
  muzzleOffset: { default: 50, min: 0, max: 120, unit: 'u (forward of ship center)' },
  /** Pool size; read once when the world is created, so changing it live has no effect. */
  bulletCap: { default: 400, min: 10, max: 2000, unit: 'bullets' },
} as const satisfies Record<string, ParamDef>;

export type WeaponsConfig = { -readonly [K in keyof typeof weaponsParams]: number };

export function createWeaponsConfig(): WeaponsConfig {
  return defaultsOf(weaponsParams);
}
