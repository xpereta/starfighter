import { defaultsOf, type ParamDef } from '../../src/core/params/params';

/** Prototype 3 parameters for this group are added by the issue that builds the module (spec: docs/specs/prototype-3-pilots.md). */
export const rescueParams = {} as const satisfies Record<string, ParamDef>;

export type RescueConfig = { -readonly [K in keyof typeof rescueParams]: number };

export function createRescueConfig(): RescueConfig {
  return defaultsOf(rescueParams);
}
