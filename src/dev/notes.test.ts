import { describe, expect, it } from 'vitest';
import { qualityParams } from '../../data/quality';
import { tuningParams, tuningToggleNotes, tuningToggles } from '../../data/tuning';
import { inputParams } from '../../data/tuning/input';

const MIN_LENGTH = 40;
const MAX_LENGTH = 300;

function checkNote(name: string, note: string | undefined, unit = ''): void {
  expect(note, `${name} needs a tooltip note`).toBeTruthy();
  const text = note as string;
  expect(text.length, `${name} note is too short`).toBeGreaterThanOrEqual(MIN_LENGTH);
  expect(text.length, `${name} note is too long`).toBeLessThanOrEqual(MAX_LENGTH);
  expect(text.trim(), `${name} note must not just repeat the unit`).not.toBe(unit);
  expect(/[a-z]{3}/i.test(text), `${name} note must be words`).toBe(true);
}

describe('tooltip notes', () => {
  it('every tuning parameter has a plain-language note', () => {
    for (const [group, defs] of Object.entries(tuningParams)) {
      for (const [key, def] of Object.entries(defs))
        checkNote(`${group}.${key}`, def.note, def.unit);
    }
    for (const [key, def] of Object.entries(inputParams))
      checkNote(`input.${key}`, def.note, def.unit);
    for (const [key, def] of Object.entries(qualityParams))
      checkNote(`quality.${key}`, def.note, def.unit);
  });

  it('every toggle has a note', () => {
    for (const [group, toggles] of Object.entries(tuningToggles)) {
      for (const key of Object.keys(toggles)) {
        checkNote(`${group}.${key}`, tuningToggleNotes[`${group}.${key}`]);
      }
    }
  });

  it('there are no notes for toggles that do not exist', () => {
    const real = new Set(
      Object.entries(tuningToggles).flatMap(([g, t]) => Object.keys(t).map((k) => `${g}.${k}`)),
    );
    for (const key of Object.keys(tuningToggleNotes)) expect(real.has(key), key).toBe(true);
  });

  it('units stay short; the explanation lives in the note', () => {
    for (const defs of Object.values(tuningParams)) {
      for (const [key, def] of Object.entries(defs)) {
        expect(def.unit.length, `${key} unit should be short`).toBeLessThanOrEqual(8);
      }
    }
  });
});
