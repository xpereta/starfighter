import { createArenaConfig, type ArenaConfig } from './arena';
import { createCameraConfig, type CameraConfig } from './camera';
import { createFlightConfig, type FlightConfig } from './flight';
import { createWeaponsConfig, type WeaponsConfig } from './weapons';

/** All live-tunable values. Core reads these through `world.tuning`; the dev panel edits them. */
export interface Tuning {
  flight: FlightConfig;
  camera: CameraConfig;
  weapons: WeaponsConfig;
  arena: ArenaConfig;
}

export function createTuning(): Tuning {
  return {
    flight: createFlightConfig(),
    camera: createCameraConfig(),
    weapons: createWeaponsConfig(),
    arena: createArenaConfig(),
  };
}
