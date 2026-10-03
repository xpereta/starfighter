import { defaultsOf, type ParamDef } from '../../src/core/params/params';

/** Practice arena content and tuning. Units: world units (u), seconds (s). */
export const arenaParams = {
  staticCount: { default: 20, min: 0, max: 100, unit: 'targets' },
  staticHp: { default: 3, min: 1, max: 20, unit: 'hp' },
  staticRadius: { default: 30, min: 10, max: 80, unit: 'u' },
  staticSpawnMin: { default: 700, min: 0, max: 20000, unit: 'u from center' },
  staticSpawnMax: { default: 5000, min: 0, max: 20000, unit: 'u from center' },

  droneCount: { default: 10, min: 0, max: 50, unit: 'drones' },
  /** Share of drones that orbit; the rest fly straight (and turn back at the arena edge). */
  droneCircleShare: { default: 0.5, min: 0, max: 1, unit: 'fraction' },
  droneHp: { default: 4, min: 1, max: 20, unit: 'hp' },
  droneRadius: { default: 26, min: 10, max: 80, unit: 'u' },
  droneSpeedMin: { default: 100, min: 20, max: 400, unit: 'u/s' },
  droneSpeedMax: { default: 250, min: 20, max: 400, unit: 'u/s' },
  droneOrbitMin: { default: 300, min: 100, max: 2000, unit: 'u' },
  droneOrbitMax: { default: 600, min: 100, max: 2000, unit: 'u' },
  droneSpawnMin: { default: 900, min: 0, max: 20000, unit: 'u from center' },
  droneSpawnMax: { default: 4500, min: 0, max: 20000, unit: 'u from center' },

  turretCount: { default: 2, min: 0, max: 10, unit: 'turrets' },
  turretHp: { default: 8, min: 1, max: 40, unit: 'hp' },
  turretRadius: { default: 42, min: 10, max: 100, unit: 'u' },
  turretFireInterval: { default: 2.5, min: 0.3, max: 10, unit: 's (+-20% jitter)' },
  turretRange: { default: 2400, min: 500, max: 8000, unit: 'u' },
  turretSpawnMin: { default: 1500, min: 0, max: 20000, unit: 'u from center' },
  turretSpawnMax: { default: 3000, min: 0, max: 20000, unit: 'u from center' },

  enemyShotSpeed: { default: 320, min: 100, max: 900, unit: 'u/s (slow, dodgeable)' },
  enemyShotLife: { default: 5, min: 1, max: 15, unit: 's' },
  enemyShotRadius: { default: 9, min: 2, max: 40, unit: 'u' },
  enemyShotCap: { default: 60, min: 5, max: 400, unit: 'shots (pool; read at world creation)' },
  playerRadius: { default: 24, min: 5, max: 80, unit: 'u (hit circle)' },

  respawnDelay: { default: 10, min: 1, max: 60, unit: 's until a destroyed target returns' },
} as const satisfies Record<string, ParamDef>;

export type ArenaConfig = { -readonly [K in keyof typeof arenaParams]: number };

export function createArenaConfig(): ArenaConfig {
  return defaultsOf(arenaParams);
}
