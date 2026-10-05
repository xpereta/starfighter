import { defaultsOf, type ParamDef } from '../../src/core/params/params';

/** Lock-on tuning (spec section 1). Units: world units (u), seconds (s); angles in degrees here, radians inside core. */
export const lockonParams = {
  coneHalfAngle: {
    default: 14,
    min: 3,
    max: 45,
    unit: '°',
    note: 'How wide the lock-on cone is, measured from the nose to each side. Higher = easier to paint targets without perfect aim, but less skill; lower = you must point right at them.',
  },
  lockRange: {
    default: 4280,
    min: 300,
    max: 5000,
    unit: 'u',
    note: 'How far ahead a target can be locked. Higher = lock enemies from far away, before a fight starts; lower = you must get close, into guns range.',
  },
  lockTime: {
    default: 0.7,
    min: 0.2,
    max: 4,
    step: 0.05,
    unit: 's',
    note: 'How long a target must stay in the cone to become a lock. Each lock in the salvo takes this long, so a full salvo takes lock time times the number of locks. Higher = locks are earned, slower dogfights; lower = almost instant locks.',
  },
  lockGrace: {
    default: 0.4,
    min: 0,
    max: 2,
    step: 0.05,
    unit: 's',
    note: 'How long a target may slip out of the cone before its lock (or its progress) is lost. Higher = forgiving, locks survive hard turns; lower = you must keep flying right at them.',
  },
  lockCap: {
    default: 5,
    min: 1,
    max: 8,
    unit: 'locks',
    note: 'The most locks the player can hold, however many wingmen there are. Normally the limit is 1 plus the number of living wingmen; this caps it. Higher = bigger possible salvos; lower = fewer targets per strike.',
  },
} as const satisfies Record<string, ParamDef>;

export type LockOnConfig = { -readonly [K in keyof typeof lockonParams]: number };

export function createLockOnConfig(): LockOnConfig {
  return defaultsOf(lockonParams);
}
