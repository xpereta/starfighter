import { createArenaConfig, type ArenaConfig } from './arena';
import { cameraParams } from './camera';
import { flightParams } from './flight';
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

/** Parameter definitions (default, range, unit) for the groups the dev panel can tune. */
export const tuningParams = {
  flight: flightParams,
  camera: cameraParams,
  weapons: weaponsParams,
} as const;
