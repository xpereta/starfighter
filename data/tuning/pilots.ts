import { defaultsOf, type ParamDef } from '../../src/core/params/params';

/** Prototype 3 parameters for this group are added by the issue that builds the module (spec: docs/specs/prototype-3-pilots.md). */
export const pilotsParams = {} as const satisfies Record<string, ParamDef>;

export type PilotsConfig = { -readonly [K in keyof typeof pilotsParams]: number };

export function createPilotsConfig(): PilotsConfig {
  return defaultsOf(pilotsParams);
}
