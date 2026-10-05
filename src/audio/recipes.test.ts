import { describe, expect, it } from 'vitest';
import { sounds as anime } from '../../data/styles/anime-80s/sounds';
import { sounds as plain } from '../../data/styles/plain/sounds';
import {
  PENDING_SOUND_EVENTS,
  SOUND_EVENT_KEYS,
  validateSounds,
  type SoundEntry,
  type SoundTable,
} from '../render/style';
import { soundDuration } from './planner';

const packs: [string, Partial<SoundTable>][] = [
  ['plain', plain],
  ['anime-80s', anime],
];

describe.each(packs)('%s sounds', (_name, table) => {
  it('validates, and the fallback pack has an entry or an explicit silent for every event', () => {
    expect(validateSounds(table)).toEqual([]);
    // `plain` is the fallback and must be complete; other packs may leave newer events to the default sound pack.
    if (_name === 'plain') for (const k of SOUND_EVENT_KEYS) expect(table[k]).toBeDefined();
  });

  it('only the pilot-kill blip is silent; everything else is audible and short', () => {
    for (const k of SOUND_EVENT_KEYS) {
      const e = table[k];
      if (e === undefined) continue;
      if (e === 'silent') {
        expect(['PilotKill', ...PENDING_SOUND_EVENTS]).toContain(k);
        continue;
      }
      const synth = e.source;
      expect(synth.kind).toBe('synth');
      expect(e.volume).toBeGreaterThan(0.1);
      expect(soundDuration(e.source)).toBeLessThan(3);
    }
  });

  it('gives every sound its own recipe (no two events sound the same)', () => {
    const seen = new Map<string, string>();
    for (const k of SOUND_EVENT_KEYS) {
      const e = table[k];
      if (e === undefined || e === 'silent') continue;
      const id = JSON.stringify((e as SoundEntry).source);
      expect(seen.get(id), `${k} duplicates ${seen.get(id)}`).toBeUndefined();
      seen.set(id, k);
    }
  });
});
