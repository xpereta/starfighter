import { defaultsOf, type ParamDef } from '../../src/core/params/params';

/** Prototype 2 parameters for this group are added by the issue that builds the module (spec: docs/specs/prototype-2-squadron.md). */
export const lockonParams = {} as const satisfies Record<string, ParamDef>;

export type LockOnConfig = { -readonly [K in keyof typeof lockonParams]: number };

export function createLockOnConfig(): LockOnConfig {
  return defaultsOf(lockonParams);
}
