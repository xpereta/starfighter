import { describe, expect, it } from 'vitest';
import { music as anime } from '../../data/styles/anime-80s/sounds';
import { music as plain } from '../../data/styles/plain/sounds';
import { validateMusic, type MusicDef } from '../render/style';
import { createAudioEngine } from './engine';
import { createFakeBackend } from './fake-backend';
import { createMixConfig } from '../../data/audio/mix';
import { silentSoundTable } from '../render/style';
import { loopLength, loopNotes, semitone, stepSeconds, type LoopSource } from './music';

const loop: LoopSource = {
  kind: 'loop',
  bpm: 120,
  root: 220,
  waveform: 'triangle',
  steps: [0, null, 12, 7],
  bass: [0, null, null, -5],
};

describe('music loop', () => {
  it('an eighth-note step is a quarter of a beat pair; the loop is steps long', () => {
    expect(stepSeconds(loop)).toBeCloseTo(0.25);
    expect(loopLength(loop)).toBeCloseTo(1);
  });

  it('turns steps into timed notes (rests skipped), with the bass two octaves down', () => {
    const notes = loopNotes(loop);
    const melody = notes.filter((n) => !n.bass);
    const bass = notes.filter((n) => n.bass);
    expect(melody.map((n) => n.at)).toEqual([0, 0.5, 0.75]);
    expect(melody[1]!.freq).toBeCloseTo(440);
    expect(bass[0]!.freq).toBeCloseTo(55);
    expect(bass[1]!.freq).toBeCloseTo(semitone(55, -5));
    for (const n of notes) {
      expect(n.at).toBeGreaterThanOrEqual(0);
      expect(n.at + n.length).toBeLessThanOrEqual(loopLength(loop));
    }
  });

  it('the shipped tracks validate', () => {
    expect(validateMusic(plain)).toEqual([]);
    expect(validateMusic(anime)).toEqual([]);
    expect(validateMusic(null)).toEqual([]);
  });

  it.each<[string, MusicDef, string]>([
    ['bad volume', { volume: 2, source: loop }, 'music.volume'],
    ['bad bpm', { volume: 1, source: { ...loop, bpm: 5 } }, 'bpm'],
    ['noise waveform', { volume: 1, source: { ...loop, waveform: 'noise' as 'sine' } }, 'waveform'],
    ['no steps', { volume: 1, source: { ...loop, steps: [] } }, 'steps'],
    ['fractional step', { volume: 1, source: { ...loop, steps: [0.5] } }, 'semitones'],
    ['bass length', { volume: 1, source: { ...loop, bass: [0] } }, 'as long as steps'],
    ['empty file', { volume: 1, source: { kind: 'sample', file: '' } }, 'file'],
  ])('rejects %s', (_n, def, text) => {
    expect(validateMusic(def).join('\n')).toContain(text);
  });
});

describe('music in the engine', () => {
  const setup = (track: MusicDef | null) => {
    const backend = createFakeBackend();
    const engine = createAudioEngine({
      backend,
      table: () => silentSoundTable(),
      music: () => track,
      mix: createMixConfig(),
    });
    return { backend, engine };
  };

  it('starts the track on unlock (not before) and can restart or stop it', () => {
    const { backend, engine } = setup(plain);
    engine.refreshMusic();
    expect(backend.music).toBeNull();
    engine.unlock();
    expect(backend.music).toBe(plain);
    const none = setup(null);
    none.engine.unlock();
    expect(none.backend.music).toBeNull();
  });
});
