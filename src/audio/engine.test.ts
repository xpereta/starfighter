import { describe, expect, it } from 'vitest';
import { createMixConfig } from '../../data/audio/mix';
import type { GameEvent } from '../core/events/events';
import {
  silentSoundTable,
  SOUND_EVENT_KEYS,
  type SoundEntry,
  type SoundTable,
} from '../render/style';
import { createAudioEngine } from './engine';
import { createFakeBackend } from './fake-backend';
import { MAX_PITCH, MIN_PITCH, soundDuration } from './planner';

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

const setup = (patch: Partial<SoundTable>, rng = () => 0.5) => {
  const backend = createFakeBackend();
  const table = { ...silentSoundTable(), ...patch };
  const mix = createMixConfig();
  const engine = createAudioEngine({ backend, table: () => table, mix, rng });
  return { backend, engine, mix, table };
};
const shot = (x = 0, y = 0): GameEvent => ({ type: 'ShotFired', x, y, angle: 0 });
const HERE = { x: 0, y: 0 };

describe('audio engine', () => {
  it('plays nothing before the first key press (unlock), then plays', () => {
    const { backend, engine } = setup({ ShotFired: beep() });
    engine.consumeEvents([shot()], HERE);
    expect(backend.played).toHaveLength(0);
    expect(backend.started).toBe(false);
    engine.unlock();
    expect(backend.started).toBe(true);
    engine.consumeEvents([shot()], HERE);
    expect(backend.played.map((p) => p.key)).toEqual(['ShotFired']);
  });

  it('silent entries play nothing; every event key has an entry or silent in the test table', () => {
    const { backend, engine, table } = setup({ ShotFired: beep() });
    for (const k of SOUND_EVENT_KEYS) expect(table[k]).toBeDefined();
    engine.unlock();
    engine.consumeEvents([{ type: 'Hit', x: 0, y: 0, dirX: 1, dirY: 0, impulse: 1 }], HERE);
    expect(backend.played).toHaveLength(0);
  });

  it('keeps pitch and volume inside bounds however extreme the table', () => {
    for (const r of [0, 0.5, 1]) {
      const { backend, engine } = setup(
        { ShotFired: beep({ pitch: 10, pitchRandom: 1, volume: 1 }) },
        () => r,
      );
      engine.unlock();
      engine.consumeEvents([shot()], HERE);
      const p = backend.played[0]!;
      expect(p.pitch).toBeGreaterThanOrEqual(MIN_PITCH);
      expect(p.pitch).toBeLessThanOrEqual(MAX_PITCH);
      expect(p.volume).toBeGreaterThanOrEqual(0);
      expect(p.volume).toBeLessThanOrEqual(1);
    }
    const low = setup({ ShotFired: beep({ pitch: 0.1, pitchRandom: 1 }) }, () => 0);
    low.engine.unlock();
    low.engine.consumeEvents([shot()], HERE);
    expect(low.backend.played[0]!.pitch).toBe(MIN_PITCH);
  });

  it('spreads the pitch by pitchRandom around the base pitch', () => {
    const lo = setup({ ShotFired: beep({ pitch: 1, pitchRandom: 0.2 }) }, () => 0);
    const hi = setup({ ShotFired: beep({ pitch: 1, pitchRandom: 0.2 }) }, () => 1);
    for (const s of [lo, hi]) {
      s.engine.unlock();
      s.engine.consumeEvents([shot()], HERE);
    }
    expect(lo.backend.played[0]!.pitch).toBeCloseTo(0.8);
    expect(hi.backend.played[0]!.pitch).toBeCloseTo(1.2);
  });

  it('respects the minimum gap', () => {
    const { backend, engine } = setup({ ShotFired: beep({ minGap: 0.1 }) });
    engine.unlock();
    engine.consumeEvents([shot(), shot()], HERE); // same instant: second one dropped
    backend.now = 0.05;
    engine.consumeEvents([shot()], HERE);
    backend.now = 0.11;
    engine.consumeEvents([shot()], HERE);
    expect(backend.played).toHaveLength(2);
  });

  it('respects max voices, and frees a voice when a sound has ended', () => {
    const { backend, engine, table } = setup({ ShotFired: beep({ maxVoices: 2 }) });
    const dur = soundDuration((table.ShotFired as SoundEntry).source);
    engine.unlock();
    engine.consumeEvents([shot(), shot(), shot()], HERE);
    expect(backend.played).toHaveLength(2);
    backend.now = dur + 0.01;
    engine.consumeEvents([shot()], HERE);
    expect(backend.played).toHaveLength(3);
  });

  it('pans by the event position relative to the player and fades with distance', () => {
    const spatial = { pan: 1, range: 1000, farVolume: 0.2 };
    const { backend, engine } = setup({ ShotFired: beep({ spatial, volume: 1 }) });
    engine.unlock();
    const at = { x: 100, y: 0 };
    engine.consumeEvents([shot(100, 0), shot(500, 0), shot(0, 0), shot(5000, 0)], at);
    const [near, mid, onTop, far] = backend.played;
    expect(near!.pan).toBeCloseTo(0);
    expect(near!.volume).toBeCloseTo(1);
    expect(mid!.pan).toBeCloseTo(0.4);
    expect(mid!.volume).toBeCloseTo(1 - 0.4 * 0.8);
    expect(onTop!.pan).toBeCloseTo(-0.1);
    expect(far!.pan).toBe(1);
    expect(far!.volume).toBeCloseTo(0.2);
    for (const p of backend.played) expect(Math.abs(p.pan)).toBeLessThanOrEqual(1);
  });

  it('events without a position play centred; a flat sound is never panned', () => {
    const spatial = { pan: 1, range: 1000, farVolume: 0.2 };
    const { backend, engine } = setup({
      LockAcquired: beep({ spatial }),
      ShotFired: beep(),
    });
    engine.unlock();
    engine.consumeEvents([{ type: 'LockAcquired', targetId: 1 }, shot(900, 0)], HERE);
    expect(backend.played.map((p) => p.pan)).toEqual([0, 0]);
  });

  it('bigger kills sound deeper and louder', () => {
    const size = { ref: 26, exponent: 1 };
    const { backend, engine } = setup({ Killed: beep({ size, volume: 0.5 }) });
    engine.unlock();
    const kill = (radius: number): GameEvent => ({
      type: 'Killed',
      entityId: 1,
      kind: 'drone',
      x: 0,
      y: 0,
      radius,
    });
    engine.consumeEvents([kill(13), kill(26), kill(104)], HERE);
    const [small, normal, big] = backend.played;
    expect(normal!.pitch).toBeCloseTo(1);
    expect(small!.pitch).toBeGreaterThan(normal!.pitch);
    expect(big!.pitch).toBeLessThan(normal!.pitch);
    expect(big!.volume).toBeGreaterThan(normal!.volume);
  });

  it('passes a duck request to the backend', () => {
    const { backend, engine } = setup({ PilotLost: beep({ duck: { amount: 0.5, time: 1 } }) });
    engine.unlock();
    engine.consumeEvents([{ type: 'PilotLost', pilotId: 1 }], HERE);
    expect(backend.ducks).toEqual([{ amount: 0.5, time: 1, bus: 'music' }]);
  });

  it('pause plays the pause sound, suspends, ignores events, and resume undoes it', () => {
    const { backend, engine } = setup({
      ShotFired: beep(),
      Paused: beep(),
      Resumed: beep(),
    });
    engine.unlock();
    engine.setPaused(true);
    expect(backend.suspended).toBe(true);
    expect(backend.played.map((p) => p.key)).toEqual(['Paused']);
    engine.consumeEvents([shot()], HERE);
    expect(backend.played).toHaveLength(1);
    engine.setPaused(true); // no change, no second blip
    expect(backend.played).toHaveLength(1);
    engine.setPaused(false);
    expect(backend.suspended).toBe(false);
    expect(backend.played.map((p) => p.key)).toEqual(['Paused', 'Resumed']);
    engine.consumeEvents([shot()], HERE);
    expect(backend.played).toHaveLength(3);
  });

  it('mute sends master 0 and keeps the volumes; the mix follows the config', () => {
    const { backend, engine, mix } = setup({});
    engine.unlock();
    expect(backend.mix.master).toBe(mix.master);
    engine.toggleMute();
    expect(engine.muted).toBe(true);
    expect(backend.mix).toEqual({
      master: 0,
      effects: mix.effects,
      music: mix.music,
      reverb: mix.reverb,
      reverbTime: mix.reverbTime,
    });
    mix.effects = 0.3;
    engine.update();
    expect(backend.mix.effects).toBe(0.3);
    engine.toggleMute();
    expect(backend.mix.master).toBe(mix.master);
  });

  it('the sound test plays at once, ignoring gaps and voices, and unlocks audio', () => {
    const { backend, engine } = setup({ Hit: beep({ minGap: 5, maxVoices: 1 }) });
    engine.playTest('Hit');
    engine.playTest('Hit');
    expect(backend.started).toBe(true);
    expect(backend.played).toHaveLength(2);
  });
});
