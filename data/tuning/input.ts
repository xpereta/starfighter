import { defaultsOf, type ParamDef } from '../../src/core/params/params';

export const inputParams = {
  stickDeadzone: { default: 0.15, min: 0, max: 0.5, unit: 'fraction of stick travel' },
} as const satisfies Record<string, ParamDef>;

export const inputTuning = defaultsOf(inputParams);
