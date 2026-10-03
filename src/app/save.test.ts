import { describe, expect, it } from 'vitest';
import { defaultSave, parseSave, SAVE_VERSION, serializeSave } from './save';

describe('save data', () => {
  it('round-trips', () => {
    const save = { version: SAVE_VERSION, bestTrialTime: 42.5 };
    expect(parseSave(serializeSave(save))).toEqual(save);
  });

  it('falls back to defaults for missing, corrupt, wrong-version or invalid data', () => {
    expect(parseSave(null)).toEqual(defaultSave());
    expect(parseSave('not json')).toEqual(defaultSave());
    expect(parseSave('42')).toEqual(defaultSave());
    expect(parseSave(JSON.stringify({ version: 999, bestTrialTime: 5 }))).toEqual(defaultSave());
    expect(
      parseSave(JSON.stringify({ version: SAVE_VERSION, bestTrialTime: -3 })).bestTrialTime,
    ).toBeNull();
    expect(
      parseSave(JSON.stringify({ version: SAVE_VERSION, bestTrialTime: 'x' })).bestTrialTime,
    ).toBeNull();
  });
});
