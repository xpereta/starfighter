import { describe, expect, it } from 'vitest';
import { defaultSave, parseSave, SAVE_VERSION, serializeSave, type SaveData } from './save';

describe('save data', () => {
  it('round-trips, veterans included', () => {
    const save: SaveData = {
      version: SAVE_VERSION,
      bestTrialTime: 42.5,
      meta: {
        veterans: [{ id: 3, name: 'Mara Ember', trait: 'bold', kills: 7, runs: 2 }],
        bestRun: 3,
      },
    };
    expect(parseSave(serializeSave(save))).toEqual(save);
  });

  it('migrates version 1 to 2 without losing the best trial time', () => {
    const migrated = parseSave(JSON.stringify({ version: 1, bestTrialTime: 31.25 }));
    expect(migrated).toEqual({
      version: SAVE_VERSION,
      bestTrialTime: 31.25,
      meta: { veterans: [], bestRun: null },
    });
    expect(parseSave(JSON.stringify({ version: 1, bestTrialTime: -1 })).bestTrialTime).toBeNull();
  });

  it('falls back to defaults for missing, corrupt, unknown-version or invalid data', () => {
    expect(parseSave(null)).toEqual(defaultSave());
    expect(parseSave('not json')).toEqual(defaultSave());
    expect(parseSave('42')).toEqual(defaultSave());
    expect(parseSave(JSON.stringify({ version: 999, bestTrialTime: 5 }))).toEqual(defaultSave());
    expect(parseSave(JSON.stringify({ version: 0, bestTrialTime: 5 }))).toEqual(defaultSave());
    expect(
      parseSave(JSON.stringify({ version: SAVE_VERSION, bestTrialTime: -3 })).bestTrialTime,
    ).toBeNull();
    expect(
      parseSave(JSON.stringify({ version: SAVE_VERSION, bestTrialTime: 'x' })).bestTrialTime,
    ).toBeNull();
  });

  it('a version 2 save without meta gets an empty one, and bad veterans are dropped', () => {
    expect(parseSave(JSON.stringify({ version: SAVE_VERSION, bestTrialTime: 9 })).meta).toEqual({
      veterans: [],
      bestRun: null,
    });
    const good = { id: 1, name: 'A B', trait: 'steady', kills: 1, runs: 1 };
    const meta = parseSave(
      JSON.stringify({
        version: SAVE_VERSION,
        bestTrialTime: null,
        meta: {
          bestRun: -2,
          veterans: [
            good,
            { ...good }, // duplicate id
            { ...good, id: 2, trait: 'nope' },
            { ...good, id: 3, name: '' },
            { ...good, id: 0 },
            { ...good, id: 4, kills: -5, runs: 'x' },
            'junk',
            null,
          ],
        },
      }),
    ).meta;
    expect(meta.bestRun).toBeNull();
    expect(meta.veterans).toEqual([good, { ...good, id: 4, kills: 0, runs: 0 }]);
  });
});
