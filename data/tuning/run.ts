import { defaultsOf, type ParamDef } from '../../src/core/params/params';

/** Prototype 3 parameters for this group are added by the issue that builds the module (spec: docs/specs/prototype-3-pilots.md). */
export const runParams = {} as const satisfies Record<string, ParamDef>;

export type RunConfig = { -readonly [K in keyof typeof runParams]: number };

export function createRunConfig(): RunConfig {
  return defaultsOf(runParams);
}
