import { describe, expect, it } from 'vitest';
import { defaultsOf, validateParam } from './params';

const def = { default: 0.15, min: 0, max: 0.5, unit: 'fraction' };

describe('params', () => {
  it('accepts values in range', () => {
    expect(validateParam('x', def, 0.3)).toBe(0.3);
  });

  it('rejects out-of-range and non-finite values', () => {
    expect(() => validateParam('x', def, 0.9)).toThrow(/outside/);
    expect(() => validateParam('x', def, NaN)).toThrow();
  });

  it('returns defaults and fails loudly on a bad default', () => {
    expect(defaultsOf({ a: def })).toEqual({ a: 0.15 });
    expect(() => defaultsOf({ a: { ...def, default: 2 } })).toThrow();
  });
});
