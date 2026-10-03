import { createArenaConfig, type ArenaConfig } from './arena';
import { arenaParams } from './arena';
import { cameraParams } from './camera';
import { flightParams } from './flight';
import { hudParams } from './hud';
import { weaponsParams } from './weapons';
import { createCameraConfig, type CameraConfig } from './camera';
import { createHudConfig, type HudConfig } from './hud';
import { createFlightConfig, type FlightConfig } from './flight';
import { createWeaponsConfig, type WeaponsConfig } from './weapons';

/** All live-tunable values. Core reads these through `world.tuning`; the dev panel edits them. */
export interface Tuning {
  flight: FlightConfig;
  camera: CameraConfig;
  weapons: WeaponsConfig;
  arena: ArenaConfig;
  hud: HudConfig;
}

export function createTuning(): Tuning {
  return {
    flight: createFlightConfig(),
    camera: createCameraConfig(),
    weapons: createWeaponsConfig(),
    arena: createArenaConfig(),
    hud: createHudConfig(),
  };
}

/** Parameter definitions (default, range, unit) for every tuning group. */
export const tuningParams = {
  flight: flightParams,
  camera: cameraParams,
  weapons: weaponsParams,
  arena: arenaParams,
  hud: hudParams,
} as const;

/** Non-numeric tuning values and the options they accept. */
export const tuningToggles: Record<keyof Tuning, Record<string, readonly (string | boolean)[]>> = {
  flight: { steering: ['point', 'rotate'], evadeSidestep: [true, false] },
  camera: { lookMode: ['velocity', 'nose'], shakeEnabled: [true, false] },
  weapons: {},
  arena: {},
  hud: {},
};
