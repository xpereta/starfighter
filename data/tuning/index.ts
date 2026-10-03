import { createFlightConfig, type FlightConfig } from './flight';

/** All live-tunable values. Core reads these through `world.tuning`; the dev panel edits them. */
export interface Tuning {
  flight: FlightConfig;
}

export function createTuning(): Tuning {
  return { flight: createFlightConfig() };
}
