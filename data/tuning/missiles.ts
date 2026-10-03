import { defaultsOf, type ParamDef } from '../../src/core/params/params';

/** Missile and salvo tuning. The issue that builds the missiles adds the rest (spec section 2). */
export const missilesParams = {
  missileCap: {
    default: 64,
    min: 8,
    max: 512,
    unit: 'missiles',
    note: 'How many missiles can be in flight at once (the pool size). It is read when the world is created, so changing it live has no effect until a reload. Higher = room for bigger salvos; lower = saves memory.',
  },
} as const satisfies Record<string, ParamDef>;

export type MissilesConfig = { -readonly [K in keyof typeof missilesParams]: number };

export function createMissilesConfig(): MissilesConfig {
  return defaultsOf(missilesParams);
}
