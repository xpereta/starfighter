import { createCameraConfig, type CameraConfig } from './camera';
import { createFlightConfig, type FlightConfig } from './flight';

/** All live-tunable values. Core reads these through `world.tuning`; the dev panel edits them. */
export interface Tuning {
  flight: FlightConfig;
  camera: CameraConfig;
}

export function createTuning(): Tuning {
  return { flight: createFlightConfig(), camera: createCameraConfig() };
}
