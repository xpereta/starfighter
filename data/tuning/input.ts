import { defaultsOf, type ParamDef } from '../../src/core/params/params';

export const inputParams = {
  stickDeadzone: {
    default: 0.15,
    min: 0,
    max: 0.5,
    unit: '',
    note: 'Part of the stick travel that is ignored around the center. Higher = no drift from a worn stick but less fine control; lower = more sensitive and may drift.',
  },
} as const satisfies Record<string, ParamDef>;

export const inputTuning = defaultsOf(inputParams);
