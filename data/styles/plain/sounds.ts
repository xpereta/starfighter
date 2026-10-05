import { AROUND, noise, sfx, tone } from '../../audio/recipes';
import type { LoopTable, MusicDef, SoundTable } from '../../../src/render/style';

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
  // Newer events: simple distinct blips, quiet; the `realistic` pack has the considered versions.
  EnemyShotFired: sfx(
    [tone('square', 500, 200, 0.08, 0.5, { filter: { type: 'lowpass', freq: 2000, q: 1 } })],
    {
      volume: 0.11,
      pitchRandom: 0.1,
      minGap: 0.2,
      maxVoices: 2,
      spatial: AROUND,
    },
  ),
  WingmanShotFired: sfx(
    [tone('square', 700, 300, 0.07, 0.5, { filter: { type: 'lowpass', freq: 3000, q: 1 } })],
    {
      volume: 0.11,
      pitchRandom: 0.1,
      minGap: 0.2,
      maxVoices: 2,
      spatial: AROUND,
    },
  ),
  PlayerDamaged: sfx([noise('lowpass', 1500, 200, 0.3, 0.9), tone('sine', 90, 45, 0.3, 0.9)], {
    volume: 0.5,
    minGap: 0.15,
    maxVoices: 2,
  }),
  WingmanHit: sfx([noise('bandpass', 1500, 500, 0.1, 0.6)], {
    volume: 0.2,
    minGap: 0.1,
    spatial: AROUND,
  }),
  WingmanDown: sfx(
    [tone('sawtooth', 400, 70, 0.6, 0.6, { filter: { type: 'lowpass', freq: 1000, q: 1 } })],
    {
      volume: 0.35,
      maxVoices: 2,
      spatial: AROUND,
    },
  ),
  MissileImpact: sfx([noise('lowpass', 2000, 200, 0.35, 0.8), tone('sine', 110, 40, 0.3, 0.8)], {
    volume: 0.4,
    minGap: 0.05,
    spatial: AROUND,
  }),
  ArenaEdgeEntered: sfx(
    [tone('square', 440, 440, 0.12, 0.5), tone('square', 330, 330, 0.16, 0.5, { delay: 0.14 })],
    {
      volume: 0.2,
      maxVoices: 1,
      minGap: 0.5,
    },
  ),
  ArenaEdgeLeft: sfx([tone('sine', 330, 440, 0.12, 0.5)], {
    volume: 0.18,
    maxVoices: 1,
    minGap: 0.5,
  }),
  PlayerRespawned: sfx([tone('sine', 300, 900, 0.4, 0.5)], {
    volume: 0.25,
    maxVoices: 1,
    minGap: 0.5,
  }),
  MenuMove: sfx([tone('sine', 900, 900, 0.03, 0.5)], {
    volume: 0.12,
    pitchRandom: 0.02,
    minGap: 0.04,
    maxVoices: 2,
  }),
  MenuSelect: sfx([tone('triangle', 600, 900, 0.09, 0.6)], {
    volume: 0.2,
    maxVoices: 1,
    minGap: 0.1,
  }),
  MenuBack: sfx([tone('triangle', 700, 450, 0.09, 0.6)], {
    volume: 0.18,
    maxVoices: 1,
    minGap: 0.1,
  }),
  MenuTick: sfx([tone('square', 1200, 1200, 0.025, 0.4)], {
    volume: 0.12,
    maxVoices: 1,
    minGap: 0.05,
  }),
  MenuPick: sfx(
    [
      tone('triangle', 700, 700, 0.08, 0.6),
      tone('triangle', 1050, 1050, 0.12, 0.6, { delay: 0.08 }),
    ],
    {
      volume: 0.25,
      maxVoices: 1,
      minGap: 0.1,
    },
  ),
  Paused: sfx([tone('sine', 500, 250, 0.16, 0.6)], { volume: 0.3, maxVoices: 1, minGap: 0.2 }),
  Resumed: sfx([tone('sine', 250, 500, 0.16, 0.6)], { volume: 0.3, maxVoices: 1, minGap: 0.2 }),
};

/**
 * Plain loops: a steady quiet hum that follows speed, a thin tone while a pod is being rescued and a
 * beeping low-hull alarm. Simple on purpose; the `realistic` pack has the layered versions.
 */
export const loops: LoopTable = {
  engine: {
    layers: [
      { waveform: 'sawtooth', freq: 70, gain: 0.5, filter: { type: 'lowpass', freq: 400, q: 1 } },
    ],
    volume: 0.12,
    gain: {
      state: 'speed',
      points: [
        [0, 0.3],
        [1, 1],
      ],
    },
    pitch: {
      state: 'speed',
      points: [
        [0, 0.8],
        [1, 1.6],
      ],
    },
    fadeIn: 0.3,
    fadeOut: 0.5,
  },
  afterburner: 'silent',
  rumble: 'silent',
  ambient: 'silent',
  missiles: 'silent',
  rescue: {
    layers: [{ waveform: 'sine', freq: 600, gain: 0.5 }],
    volume: 0.11,
    gain: {
      state: 'rescue',
      points: [
        [0, 0],
        [0.02, 1],
        [1, 1],
      ],
    },
    pitch: {
      state: 'rescue',
      points: [
        [0, 0.8],
        [1, 1.6],
      ],
    },
    fadeIn: 0.1,
    fadeOut: 0.3,
  },
  hullAlarm: {
    layers: [
      {
        waveform: 'square',
        freq: 520,
        gain: 0.5,
        tremolo: { rate: 2, depth: 1, shape: 'square' },
        filter: { type: 'lowpass', freq: 1500, q: 1 },
      },
    ],
    volume: 0.11,
    gain: {
      state: 'hull',
      points: [
        [0, 1],
        [0.34, 1],
        [0.35, 0],
        [1, 0],
      ],
    },
    fadeIn: 0.1,
    fadeOut: 0.3,
  },
  edgeAlarm: 'silent',
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
