import { describe, expect, it } from 'vitest';
import {
  checkStyle,
  validateMusic,
  type SoundEntry,
  type StyleInput,
  type StyleManifest,
} from './style';

const manifest: StyleManifest = {
  id: 'test-pack',
  name: 'Test pack',
  intent: 'A pack for tests.',
  parent: null,
  references: [],
  status: 'idea',
  notes: '',
};
const layer = { waveform: 'sine' as const, freq: 100, attack: 0.01, decay: 0.2, gain: 0.5 };
const entry = (over: Partial<SoundEntry> = {}): SoundEntry => ({
  source: { kind: 'synth', layers: [layer] },
  pitch: 1,
  pitchRandom: 0.1,
  volume: 0.5,
  minGap: 0.05,
  maxVoices: 4,
  ...over,
});
const pack = (hit: SoundEntry): StyleInput => ({ manifest, sounds: { Hit: hit } });
const withLayer = (over: object): StyleInput =>
  pack(entry({ source: { kind: 'synth', layers: [{ ...layer, ...over }] } }));

describe('sound synthesis fields (additive contract)', () => {
  it('old sounds without the new fields stay valid', () => {
    expect(checkStyle(pack(entry()))).toEqual([]);
  });

  it('accepts every new optional field', () => {
    expect(
      checkStyle(
        withLayer({
          hold: 0.3,
          detune: -12,
          distortion: 0.4,
          tremolo: { rate: 8, depth: 0.5 },
          waveform: 'brown',
        }),
      ),
    ).toEqual([]);
    expect(
      checkStyle(
        pack(
          entry({
            reverb: 0.5,
            preDelay: 0.04,
            duckLoops: { amount: 0.5, time: 1 },
            spatial: {
              pan: 1,
              range: 500,
              farVolume: 0.3,
              lowpass: { near: 9000, far: 700 },
              farReverb: 0.3,
              lag: 0.1,
            },
          }),
        ),
      ),
    ).toEqual([]);
  });

  it.each([
    ['hold', { hold: 20 }, 'hold'],
    ['detune', { detune: 5000 }, 'detune'],
    ['distortion', { distortion: 2 }, 'distortion'],
    ['tremolo rate', { tremolo: { rate: 0, depth: 0.5 } }, 'tremolo.rate'],
    ['tremolo depth', { tremolo: { rate: 5, depth: 2 } }, 'tremolo.depth'],
    ['unknown waveform', { waveform: 'violin' }, 'waveform'],
  ])('rejects a bad %s', (_name, over, expected) => {
    expect(checkStyle(withLayer(over)).join()).toContain(expected);
  });

  it('rejects bad sound-level fields, naming each', () => {
    const errors = checkStyle(
      pack(
        entry({
          reverb: 3,
          preDelay: 2,
          duckLoops: { amount: 2, time: 0 },
          spatial: {
            pan: 1,
            range: 100,
            farVolume: 1,
            lowpass: { near: 5, far: 99999 },
            lag: 5,
          },
        }),
      ),
    ).join('\n');
    for (const f of [
      '.reverb',
      'preDelay',
      'duckLoops.amount',
      'lowpass.near',
      'lowpass.far',
      'lag',
    ])
      expect(errors).toContain(f);
  });

  it('allows up to 12 layers and no more', () => {
    const many = (n: number) =>
      pack(entry({ source: { kind: 'synth', layers: Array.from({ length: n }, () => layer) } }));
    expect(checkStyle(many(12))).toEqual([]);
    expect(checkStyle(many(13)).join()).toContain('layers');
  });

  it('noise waveforms are not allowed for the music', () => {
    for (const waveform of ['noise', 'pink', 'brown'])
      expect(
        validateMusic({
          volume: 0.5,
          source: { kind: 'loop', bpm: 90, root: 220, waveform: waveform as never, steps: [0] },
        }).join(),
      ).toContain('waveform');
  });
});
