import { AROUND, noise, sfx, tone } from '../../audio/recipes';
import type { MusicDef, SoundTable } from '../../../src/render/style';

/**
 * Plain sounds: simple, audible and distinct (beeps, sweeps and noise bursts), so the engine and
 * every event can be heard without any art direction. Layers are oscillators or noise with an
 * envelope (attack/decay), a pitch sweep and an optional filter: edit the numbers, or use the
 * panel's Sound section.
 */
export const sounds: SoundTable = {
  ShotFired: sfx(
    [tone('square', 900, 250, 0.09, 0.5, { filter: { type: 'lowpass', freq: 3500, q: 1 } })],
    {
      // Guns fire ~20 times a second: one blip per shot melts into a buzz, so only every ~0.13 s is voiced.
      volume: 0.16,
      pitchRandom: 0.1,
      minGap: 0.13,
      maxVoices: 2,
      spatial: AROUND,
    },
  ),
  Hit: sfx([noise('bandpass', 2000, 600, 0.09, 0.7), tone('sine', 320, 120, 0.08, 0.5)], {
    volume: 0.35,
    minGap: 0.04,
    spatial: AROUND,
  }),
  Killed: sfx([noise('lowpass', 2800, 180, 0.55, 0.9), tone('sine', 130, 40, 0.5, 0.9)], {
    volume: 0.6,
    pitchRandom: 0.12,
    minGap: 0.06,
    spatial: { pan: 0.8, range: 1200, farVolume: 0.4 },
    size: { ref: 26, exponent: 0.8 },
    duck: { amount: 0.3, time: 0.6 },
  }),
  EvadeStarted: sfx([noise('highpass', 400, 3500, 0.28, 0.6, { attack: 0.08 })], {
    volume: 0.3,
    minGap: 0.3,
    maxVoices: 1,
  }),
  LockAcquiring: sfx([tone('sine', 700, 700, 0.07, 0.6)], {
    volume: 0.2,
    minGap: 0.08,
    maxVoices: 1,
  }),
  LockAcquired: sfx(
    [
      tone('triangle', 1000, 1000, 0.1, 0.6),
      tone('triangle', 1500, 1500, 0.14, 0.6, { delay: 0.08 }),
    ],
    { volume: 0.3, maxVoices: 2 },
  ),
  LockLost: sfx([tone('sine', 600, 300, 0.22, 0.6)], { volume: 0.22, maxVoices: 2 }),
  SalvoFired: sfx(
    [
      noise('bandpass', 400, 1800, 0.55, 0.8, { attack: 0.12 }),
      tone('sawtooth', 140, 320, 0.5, 0.5, {
        attack: 0.1,
        filter: { type: 'lowpass', freq: 900, q: 1 },
      }),
    ],
    { volume: 0.4, minGap: 0.2, maxVoices: 2 },
  ),
  MissileLaunched: sfx(
    [
      tone('sawtooth', 220, 900, 0.45, 0.6, {
        filter: { type: 'lowpass', freq: 1400, freqEnd: 3500, q: 1 },
      }),
      noise('highpass', 800, 4000, 0.4, 0.4),
    ],
    { volume: 0.35, minGap: 0.08, spatial: AROUND },
  ),
  OrderGiven: sfx(
    [tone('triangle', 660, 660, 0.07, 0.6), tone('triangle', 880, 880, 0.09, 0.6, { delay: 0.09 })],
    { volume: 0.25, maxVoices: 1, minGap: 0.2, duck: { amount: 0.3, time: 0.7 } },
  ),
  BattleStarted: sfx(
    [
      tone('triangle', 440, 440, 0.25, 0.6),
      tone('triangle', 554, 554, 0.25, 0.6, { delay: 0.12 }),
      tone('triangle', 659, 659, 0.45, 0.6, { delay: 0.24 }),
    ],
    { volume: 0.35, maxVoices: 1, minGap: 1 },
  ),
  WaveStarted: sfx(
    [tone('sawtooth', 110, 165, 0.55, 0.6, { filter: { type: 'lowpass', freq: 600, q: 2 } })],
    {
      volume: 0.3,
      maxVoices: 1,
      minGap: 1,
    },
  ),
  BattleCleared: sfx(
    [523, 659, 784, 1047].map((f, i) =>
      tone('triangle', f, f, i === 3 ? 0.7 : 0.2, 0.6, { delay: i * 0.1 }),
    ),
    { volume: 0.4, maxVoices: 1, minGap: 1 },
  ),
  RunEnded: sfx(
    [
      tone('sawtooth', 220, 215, 1.4, 0.45, {
        attack: 0.05,
        filter: { type: 'lowpass', freq: 1200, q: 1 },
      }),
      tone('sawtooth', 330, 322, 1.4, 0.35, {
        attack: 0.05,
        filter: { type: 'lowpass', freq: 1200, q: 1 },
      }),
    ],
    { volume: 0.4, maxVoices: 1, minGap: 2 },
  ),
  PilotJoined: sfx([tone('triangle', 600, 900, 0.18, 0.6)], {
    volume: 0.3,
    maxVoices: 2,
    duck: { amount: 0.3, time: 0.7 },
  }),
  PilotLost: sfx(
    [tone('sine', 440, 220, 0.5, 0.6), tone('sine', 330, 165, 0.5, 0.5, { delay: 0.12 })],
    { volume: 0.4, maxVoices: 2, duck: { amount: 0.4, time: 1 } },
  ),
  PilotKill: 'silent', // the kill itself already sounds
  PodSpawned: sfx(
    [tone('sine', 1400, 1400, 0.35, 0.6), tone('sine', 1400, 1400, 0.35, 0.4, { delay: 0.16 })],
    { volume: 0.22, maxVoices: 2, spatial: AROUND },
  ),
  PodRescued: sfx(
    [tone('triangle', 784, 784, 0.12, 0.6), tone('triangle', 1175, 1175, 0.3, 0.6, { delay: 0.1 })],
    { volume: 0.4, maxVoices: 2, duck: { amount: 0.3, time: 0.7 } },
  ),
  PodLost: sfx(
    [tone('sawtooth', 300, 80, 0.5, 0.6, { filter: { type: 'lowpass', freq: 900, q: 1 } })],
    {
      volume: 0.35,
      maxVoices: 2,
    },
  ),
  Paused: sfx([tone('sine', 500, 250, 0.16, 0.6)], { volume: 0.3, maxVoices: 1, minGap: 0.2 }),
  Resumed: sfx([tone('sine', 250, 500, 0.16, 0.6)], { volume: 0.3, maxVoices: 1, minGap: 0.2 }),
};

/** A sparse, quiet pulse so the music slot can be heard; set the Music volume to 0 to remove it. */
export const music: MusicDef = {
  volume: 0.25,
  source: {
    kind: 'loop',
    bpm: 90,
    root: 220,
    waveform: 'triangle',
    steps: [0, null, null, null, 7, null, null, null, 3, null, null, null, 7, null, 5, null],
    bass: [
      0,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      -4,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ],
  },
};
