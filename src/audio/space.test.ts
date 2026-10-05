import { describe, expect, it } from 'vitest';
import { createMixConfig } from '../../data/audio/mix';
import type { GameEvent } from '../core/events/events';
import { silentSoundTable, type SoundEntry, type SoundTable } from '../render/style';
import { createAudioEngine } from './engine';
import { createFakeBackend } from './fake-backend';
import { soundDuration } from './planner';
import { ceilingCurve, distortionCurve, impulseResponse, OUTPUT_CEILING } from './webaudio';

const beep = (over: Partial<SoundEntry> = {}): SoundEntry => ({
  source: {
    kind: 'synth',
    layers: [{ waveform: 'sine', freq: 440, attack: 0.01, decay: 0.2, gain: 0.5 }],
  },
  pitch: 1,
  pitchRandom: 0,
  volume: 0.8,
  minGap: 0,
  maxVoices: 8,
  ...over,
});
const setup = (patch: Partial<SoundTable>) => {
  const backend = createFakeBackend();
  const table = { ...silentSoundTable(), ...patch };
  const engine = createAudioEngine({ backend, table: () => table, mix: createMixConfig() });
  engine.unlock();
  return { backend, engine };
};
const shot = (x: number): GameEvent => ({ type: 'ShotFired', x, y: 0, angle: 0 });
const HERE = { x: 0, y: 0 };

describe('space and distance cues', () => {
  const spatial = {
    pan: 1,
    range: 1000,
    farVolume: 0.5,
    lowpass: { near: 8000, far: 500 },
    farReverb: 0.4,
    lag: 0.2,
  };

  it('muffles, wets and delays far sounds, and leaves near ones clear', () => {
    const { backend, engine } = setup({
      ShotFired: beep({ spatial, reverb: 0.2, preDelay: 0.03 }),
    });
    engine.consumeEvents([shot(0), shot(1000), shot(5000)], HERE);
    const [near, far, farther] = backend.played;
    expect(near!.cutoff).toBeCloseTo(8000);
    expect(near!.send).toBeCloseTo(0.2);
    expect(near!.startDelay).toBe(0);
    expect(far!.cutoff).toBeCloseTo(500);
    expect(far!.send).toBeCloseTo(0.6);
    expect(far!.startDelay).toBeCloseTo(0.2);
    expect(far!.preDelay).toBe(0.03);
    expect(farther!.cutoff).toBeCloseTo(500); // beyond range is as far as it gets
    expect(far!.duration).toBeGreaterThan(near!.duration);
  });

  it('half way is half way in the log of the cutoff', () => {
    const { backend, engine } = setup({ ShotFired: beep({ spatial }) });
    engine.consumeEvents([shot(500)], HERE);
    expect(backend.played[0]!.cutoff).toBeCloseTo(Math.sqrt(8000 * 500), 0);
  });

  it('a sound without spatial or reverb fields plays dry, unfiltered and on time', () => {
    const { backend, engine } = setup({ ShotFired: beep() });
    engine.consumeEvents([shot(300)], HERE);
    expect(backend.played[0]).toMatchObject({ cutoff: 0, send: 0, preDelay: 0, startDelay: 0 });
  });

  it('keeps the send inside 0..1 however much is added', () => {
    const { backend, engine } = setup({
      ShotFired: beep({ spatial: { ...spatial, farReverb: 1 }, reverb: 1 }),
    });
    engine.consumeEvents([shot(1000)], HERE);
    expect(backend.played[0]!.send).toBe(1);
  });

  it('a sound that dips the loops tells the backend which bus', () => {
    const { backend, engine } = setup({
      Killed: beep({ duck: { amount: 0.3, time: 1 }, duckLoops: { amount: 0.6, time: 2 } }),
    });
    engine.consumeEvents(
      [{ type: 'Killed', entityId: 1, kind: 'drone', x: 0, y: 0, radius: 20 }],
      HERE,
    );
    expect(backend.ducks).toEqual([
      { amount: 0.3, time: 1, bus: 'music' },
      { amount: 0.6, time: 2, bus: 'loops' },
    ]);
  });

  it('a hold counts towards how long a sound lasts (so its voice is freed late)', () => {
    const layers = [
      { waveform: 'sine' as const, freq: 100, attack: 0.1, hold: 0.5, decay: 0.4, gain: 1 },
    ];
    expect(soundDuration({ kind: 'synth', layers })).toBeCloseTo(1);
  });

  it('the events added for sound pan and fade like the old ones', () => {
    const { backend, engine } = setup({
      EnemyShotFired: beep({ spatial: { pan: 1, range: 1000, farVolume: 0.5 } }),
    });
    engine.consumeEvents(
      [{ type: 'EnemyShotFired', x: 1000, y: 0, angle: 0, from: 'turret' }],
      HERE,
    );
    expect(backend.played[0]!.pan).toBe(1);
    expect(backend.played[0]!.volume).toBeCloseTo(0.4);
  });
});

describe('synthesis helpers', () => {
  it('the distortion curve is odd, bounded and steeper with more drive', () => {
    const soft = distortionCurve(0.1);
    const hard = distortionCurve(1);
    const mid = Math.floor(soft.length * 0.55);
    expect(Math.max(...hard)).toBeLessThanOrEqual(1.0001);
    expect(hard[mid]!).toBeGreaterThan(soft[mid]!);
    expect(soft[0]).toBeCloseTo(-soft[soft.length - 1]!);
  });

  it('the output ceiling never lets a sample past the ceiling and leaves quiet sounds alone', () => {
    const curve = ceilingCurve();
    expect(Math.max(...curve)).toBeLessThanOrEqual(OUTPUT_CEILING);
    expect(Math.min(...curve)).toBeGreaterThanOrEqual(-OUTPUT_CEILING);
    const at = (x: number): number => curve[Math.round(((x + 1) / 2) * (curve.length - 1))]!;
    expect(at(0.3)).toBeCloseTo(0.3, 2);
    expect(at(-0.5)).toBeCloseTo(-0.5, 2);
  });

  it('the generated room decays and gets quieter towards its end', () => {
    const sampleRate = 8000;
    const left = new Float32Array(sampleRate * 2);
    const right = new Float32Array(sampleRate * 2);
    let s = 1;
    const random = (): number => (s = (s * 16807) % 2147483647) / 2147483647;
    impulseResponse([left, right], sampleRate, random);
    const energy = (data: Float32Array, from: number, to: number): number => {
      let sum = 0;
      for (let i = from; i < to; i++) sum += data[i]! * data[i]!;
      return sum / (to - from);
    };
    const n = left.length;
    expect(energy(left, 0, n / 4)).toBeGreaterThan(energy(left, n / 2, (3 * n) / 4) * 4);
    expect(energy(left, (3 * n) / 4, n)).toBeLessThan(energy(left, 0, n / 4) / 50);
    expect(left).not.toEqual(right); // two different channels: a wide room
  });
});
