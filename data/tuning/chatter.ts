import { defaultsOf, type ParamDef } from '../../src/core/params/params';

/** Prototype 3 parameters for this group are added by the issue that builds the module (spec: docs/specs/prototype-3-pilots.md). */
export const chatterParams = {} as const satisfies Record<string, ParamDef>;

export type ChatterConfig = { -readonly [K in keyof typeof chatterParams]: number };

export function createChatterConfig(): ChatterConfig {
  return defaultsOf(chatterParams);
}
