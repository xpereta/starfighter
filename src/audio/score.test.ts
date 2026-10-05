import { describe, expect, it } from 'vitest';
import { loops } from '../../data/styles/anime-spectacle/loops';
import { music, score } from '../../data/styles/anime-spectacle/music';
import { sounds } from '../../data/styles/anime-spectacle/sounds';
import {
  checkStyle,
  SOUND_EVENT_KEYS,
  validateMusic,
  LOOP_KEYS,
  type MusicDef,
} from '../render/style';
import {
  degreePitch,
  gateGain,
  motifHits,
  semitones,
  stemNotes,
  stepSeconds,
  stingerNotes,
  validateScore,
  type ScoreDef,
} from './score';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Loose = any;
const clone = (s: ScoreDef): ScoreDef => structuredClone(s);

describe('the spectacle pack', () => {
  it('validates: score, sounds, loops and music', () => {
    expect(validateScore(score)).toEqual([]);
    expect(validateMusic(music)).toEqual([]);
    expect(
      checkStyle({
        manifest: {
          id: 'anime-spectacle',
          name: 'x',
          intent: 'x',
          parent: 'plain',
          references: [{ title: 'x', took: 'x' }],
          status: 'idea',
          notes: 'x',
        },
        sounds,
        loops,
        music,
      }),
    ).toEqual([]);
  });

  it('has a sound (or an explicit silent) for every event and an entry for every loop', () => {
    for (const k of SOUND_EVENT_KEYS) expect(sounds[k], k).toBeDefined();
    for (const k of LOOP_KEYS) expect(loops[k], k).toBeDefined();
    const silent = SOUND_EVENT_KEYS.filter((k) => sounds[k] === 'silent');
    expect(silent).toEqual(['PilotKill']);
  });

  it('is composed: one tempo and key, a motif system and the cues the scenes need', () => {
    expect(score.bpm).toBeGreaterThanOrEqual(100);
    expect(Object.keys(score.motifs).length).toBeGreaterThanOrEqual(4);
    for (const cue of Object.values(score.cues)) expect(cue.chords).toHaveLength(cue.bars);
    const battle = score.cues['battle']!;
    // Layers for every role of the brief.
    const instrumentsUsed = new Set(battle.stems.map((s) => s.instrument));
    for (const i of ['pad', 'subBass', 'driveBass', 'pluck', 'brass', 'lead', 'kit', 'horn'])
      expect(instrumentsUsed.has(i), i).toBe(true);
    for (const k of [
      'battleStart',
      'waveStart',
      'victory',
      'finale',
      'defeat',
      'pilotLost',
      'rescued',
    ])
      expect(score.stingers[k], k).toBeDefined();
  });
});

describe('score helpers', () => {
  it('chord degrees walk the chord tones and wrap up an octave (and down for negatives)', () => {
    const chord = { root: 3, tones: [0, 4, 7, 11] };
    expect(degreePitch(chord, 0)).toBe(3);
    expect(degreePitch(chord, 2)).toBe(10);
    expect(degreePitch(chord, 4)).toBe(15);
    expect(degreePitch(chord, -1)).toBe(3 + 11 - 12);
  });

  it('semitones and step lengths', () => {
    expect(semitones(110, 12)).toBeCloseTo(220);
    expect(stepSeconds(120)).toBeCloseTo(0.125);
  });

  it('a gate rises from on to full and (optionally) falls again from out to outFull', () => {
    const g = { input: 'intensity', on: 0.2, full: 0.4, out: 0.6, outFull: 0.8 } as const;
    expect(gateGain(g, 0)).toBe(0);
    expect(gateGain(g, 0.3)).toBeGreaterThan(0);
    expect(gateGain(g, 0.3)).toBeLessThan(1);
    expect(gateGain(g, 0.5)).toBe(1);
    expect(gateGain(g, 0.7)).toBeGreaterThan(0);
    expect(gateGain(g, 0.7)).toBeLessThan(1);
    expect(gateGain(g, 1)).toBe(0);
    expect(gateGain({ input: 'intensity', on: 0.5, full: 0.5 }, 0.6)).toBe(1);
  });

  it('motif statements are shifted in time and transposed', () => {
    const hits = motifHits(score, [{ motif: 'lone', bar: 2, transpose: 3, octave: 1 }]);
    const first = score.motifs['lone']![0]!;
    expect(hits[0]!.step).toBe(first[0] + 32);
    expect(hits[0]!.pitch).toBe(first[1] + 3 + 12);
  });

  it("a chord stem repeats each bar over that bar's chord; drums and line stems pick their bar", () => {
    const battle = score.cues['battle']!;
    const pad = battle.stems.find((s) => s.id === 'pad')!;
    const bar0 = stemNotes(score, battle, pad, 0);
    const bar1 = stemNotes(score, battle, pad, 1);
    expect(bar0).toHaveLength(4);
    expect(bar0[0]!.kind === 'pitched' && bar1[0]!.kind === 'pitched').toBe(true);
    if (bar0[0]!.kind === 'pitched' && bar1[0]!.kind === 'pitched')
      expect(bar1[0]!.freq).toBeLessThan(bar0[0]!.freq); // Fmaj7 is below Am7
    const fill = battle.stems.find((s) => s.id === 'fill')!;
    expect(stemNotes(score, battle, fill, 0)).toHaveLength(0);
    expect(stemNotes(score, battle, fill, 3).length).toBeGreaterThan(0);
    const lead = battle.stems.find((s) => s.id === 'lead')!;
    const everyBar = Array.from(
      { length: battle.bars },
      (_, b) => stemNotes(score, battle, lead, b).length,
    );
    expect(everyBar.every((n) => n > 0)).toBe(true);
  });

  it('stinger notes come out sorted and inside the stinger', () => {
    for (const [key, st] of Object.entries(score.stingers)) {
      const notes = stingerNotes(score, st);
      expect(notes.length, key).toBeGreaterThan(0);
      const end = st.steps * stepSeconds(score.bpm);
      for (let i = 0; i < notes.length; i++) {
        expect(notes[i]!.at).toBeLessThan(end);
        if (i) expect(notes[i]!.at).toBeGreaterThanOrEqual(notes[i - 1]!.at);
      }
    }
  });
});

describe('score validation rejects bad data', () => {
  const bad = (edit: (s: ScoreDef) => void): string => {
    const s = clone(score);
    edit(s);
    return validateScore(s).join('\n');
  };
  const cue = (s: ScoreDef): Loose => s.cues['battle'] as unknown as Loose;

  it.each<[string, (s: ScoreDef) => void, string]>([
    ['bpm', (s) => void (s.bpm = 10), 'bpm'],
    ['key', (s) => void (s.key = 0), 'key'],
    ['stinger level', (s) => void (s.stingerLevel = 9), 'stingerLevel'],
    ['unknown instrument', (s) => void (cue(s).stems[0]!.instrument = 'nope'), 'does not exist'],
    ['kit for a chord pattern', (s) => void (cue(s).stems[0]!.instrument = 'kit'), 'pitched'],
    ['chord count', (s) => void cue(s).chords.pop(), 'one chord per bar'],
    ['duplicate stem id', (s) => void (cue(s).stems[1]!.id = cue(s).stems[0]!.id), 'unique'],
    ['gate input', (s) => void (cue(s).stems[0]!.gate.input = 'luck'), 'gate.input'],
    ['step out of range', (s) => void (cue(s).stems[0]!.pattern.hits[0][0] = 99), 'step'],
    [
      'unknown motif',
      (s) =>
        void (cue(s).stems.find((x: Loose) => x.id === 'lead')!.pattern.statements[0].motif =
          'zzz'),
      'motif',
    ],
    ['unknown scene cue', (s) => void ((s.scenes as { menu: string }).menu = 'zzz'), 'scenes.menu'],
    [
      'trigger to nowhere',
      (s) => void ((s.triggers as unknown as Loose[])[0].stinger = 'zzz'),
      'stinger "zzz"',
    ],
    [
      'drum piece',
      (s) => void (cue(s).stems.find((x: Loose) => x.id === 'kick')!.pattern.hits[0][1] = 'gong'),
      'not in the kit',
    ],
    ['stinger steps', (s) => void (s.stingers['victory']!.steps = 0), 'steps'],
    ['intensity rise', (s) => void (s.intensity.rise = 0), 'rise'],
  ])('%s', (_name, edit, text) => {
    expect(bad(edit)).toContain(text);
  });

  it('the style contract rejects an invalid score and a bad kit layer', () => {
    const broken = clone(score);
    (broken.instruments['kit'] as unknown as Loose).pieces.kick.layers[0].gain = 4;
    const def: MusicDef = { volume: 0.5, source: { kind: 'score', score: broken } };
    expect(validateMusic(def).join('\n')).toContain('gain must be 0..1');
    const def2: MusicDef = {
      volume: 0.5,
      source: { kind: 'score', score: undefined as unknown as ScoreDef },
    };
    expect(validateMusic(def2).join('\n')).toContain('must be a score');
  });
});
