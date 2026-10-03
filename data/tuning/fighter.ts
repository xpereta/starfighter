import { defaultsOf, type ParamDef } from '../../src/core/params/params';

/** Prototype 2 parameters for this group are added by the issue that builds the module (spec: docs/specs/prototype-2-squadron.md). */
export const fighterParams = {} as const satisfies Record<string, ParamDef>;

export type FighterConfig = { -readonly [K in keyof typeof fighterParams]: number };

export function createFighterConfig(): FighterConfig {
  return defaultsOf(fighterParams);
}
