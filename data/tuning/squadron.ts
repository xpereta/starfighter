import { defaultsOf, type ParamDef } from '../../src/core/params/params';

/** Prototype 2 parameters for this group are added by the issue that builds the module (spec: docs/specs/prototype-2-squadron.md). */
export const squadronParams = {} as const satisfies Record<string, ParamDef>;

export type SquadronConfig = { -readonly [K in keyof typeof squadronParams]: number };

export function createSquadronConfig(): SquadronConfig {
  return defaultsOf(squadronParams);
}
