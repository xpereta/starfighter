import type { LoopLayer, LoopTable } from '../../../src/render/style';

const layer = (
  waveform: LoopLayer['waveform'],
  freq: number,
  gain: number,
  more: Partial<LoopLayer> = {},
): LoopLayer => ({ waveform, freq, gain, ...more });

const lp = (freq: number, q = 0.7): LoopLayer['filter'] => ({ type: 'lowpass', freq, q });
const bp = (freq: number, q = 0.7): LoopLayer['filter'] => ({ type: 'bandpass', freq, q });
const hp = (freq: number, q = 0.7): LoopLayer['filter'] => ({ type: 'highpass', freq, q });

/**
 * Continuous sounds of the spectacular pack. They are fuller than the realistic pack's (a ship you
 * can feel): the engine swells with speed and opens up with throttle, the afterburner is a roar with a
 * rising turbine whine, speed adds a wind-like rumble, and a deep space drone sits under everything.
 * Big bangs duck them (`duckLoops` on the sound). Alarms pulse; a held tone would just be a drone.
 */
export const loops: LoopTable = {
  engine: {
    layers: [
      layer('brown', 100, 0.8, { filter: lp(260) }),
      layer('sawtooth', 55, 0.24, { detune: 9, distortion: 0.2, filter: lp(300) }),
      layer('sawtooth', 55, 0.24, { detune: -9, distortion: 0.2, filter: lp(300) }),
      layer('triangle', 220, 0.1, { filter: bp(700, 3) }),
      layer('sine', 41, 0.35),
    ],
    volume: 0.045,
    gain: {
      state: 'speed',
      points: [
        [0, 0.4],
        [0.5, 0.7],
        [1, 1],
      ],
    },
    pitch: {
      state: 'speed',
      points: [
        [0, 0.8],
        [1, 1.7],
      ],
    },
    cutoff: {
      state: 'throttle',
      points: [
        [-1, 0.6],
        [0, 1],
        [1, 2.2],
      ],
    },
    fadeIn: 0.6,
    fadeOut: 0.9,
    reverb: 0.06,
  },
  afterburner: {
    layers: [
      layer('pink', 1000, 0.7, { filter: bp(1000, 0.6) }),
      layer('brown', 450, 0.8, { filter: lp(500) }),
      layer('sawtooth', 70, 0.2, { distortion: 0.4, filter: lp(320) }),
      layer('sawtooth', 380, 0.07, { detune: 12, filter: bp(900, 4) }),
    ],
    volume: 0.08,
    gain: {
      state: 'throttle',
      points: [
        [0, 0],
        [0.25, 0],
        [1, 1],
      ],
    },
    pitch: {
      state: 'throttle',
      points: [
        [0.25, 0.85],
        [1, 1.5],
      ],
    },
    cutoff: {
      state: 'speed',
      points: [
        [0, 0.7],
        [1, 1.6],
      ],
    },
    fadeIn: 0.3,
    fadeOut: 0.6,
    reverb: 0.1,
  },
  rumble: {
    layers: [
      layer('pink', 500, 0.8, { filter: bp(500, 0.6) }),
      layer('noise', 3500, 0.1, { filter: hp(3500) }),
    ],
    volume: 0.04,
    gain: {
      state: 'speed',
      points: [
        [0, 0],
        [0.5, 0.1],
        [1, 1],
      ],
    },
    cutoff: {
      state: 'speed',
      points: [
        [0, 0.6],
        [1, 2],
      ],
    },
    fadeIn: 0.8,
    fadeOut: 1,
  },
  // Space: a deep drone with a slow beat, a low pad a fifth above and a faint glassy shimmer.
  ambient: {
    layers: [
      layer('brown', 90, 0.55, { filter: lp(100) }),
      layer('sine', 41, 0.4),
      layer('sine', 41.5, 0.4),
      layer('sawtooth', 82.4, 0.12, { tremolo: { rate: 0.1, depth: 0.6 }, filter: lp(220) }),
      layer('sine', 1244, 0.03, { tremolo: { rate: 0.13, depth: 0.9 } }),
    ],
    volume: 0.035,
    gain: {
      state: 'always',
      points: [
        [0, 0],
        [1, 1],
      ],
    },
    fadeIn: 1.5,
    fadeOut: 1.5,
    reverb: 0.1,
  },
  missiles: {
    layers: [
      layer('pink', 1800, 0.6, { tremolo: { rate: 14, depth: 0.2 }, filter: bp(1800, 1.2) }),
      layer('noise', 4200, 0.12, { filter: hp(4200) }),
      layer('sawtooth', 220, 0.05, { distortion: 0.2, filter: lp(900) }),
    ],
    volume: 0.07,
    gain: {
      state: 'missiles',
      points: [
        [0, 0],
        [0.1, 0.7],
        [1, 1],
      ],
    },
    pitch: {
      state: 'missiles',
      points: [
        [0, 1.2],
        [1, 0.9],
      ],
    },
    fadeIn: 0.15,
    fadeOut: 0.9,
    reverb: 0.25,
  },
  // A rescue in progress: a sonar-like pair of tones that climbs as the pod is picked up.
  rescue: {
    layers: [
      layer('sine', 880, 0.6, { filter: lp(3500) }),
      layer('sine', 1320, 0.3, { tremolo: { rate: 3, depth: 0.6 }, filter: lp(3500) }),
      layer('triangle', 440, 0.2, { tremolo: { rate: 1.5, depth: 0.7 }, filter: lp(2000) }),
    ],
    volume: 0.03,
    gain: {
      state: 'rescue',
      points: [
        [0, 0],
        [0.01, 1],
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
    fadeIn: 0.15,
    fadeOut: 0.4,
    reverb: 0.3,
  },
  // Hull alarm: a pulsing two-tone siren while the hull is below 40 %.
  hullAlarm: {
    layers: [
      layer('square', 880, 0.28, {
        tremolo: { rate: 2.4, depth: 1, shape: 'square' },
        filter: lp(2600),
      }),
      layer('square', 1100, 0.2, {
        tremolo: { rate: 2.4, depth: 1, shape: 'square' },
        filter: lp(2600),
      }),
      layer('sine', 55, 0.4, { tremolo: { rate: 1.2, depth: 0.8 } }),
    ],
    volume: 0.06,
    gain: {
      state: 'hull',
      points: [
        [0, 1],
        [0.4, 1],
        [0.41, 0],
        [1, 0],
      ],
    },
    fadeIn: 0.1,
    fadeOut: 0.4,
    reverb: 0.15,
  },
  edgeAlarm: {
    layers: [
      layer('square', 660, 0.3, {
        tremolo: { rate: 3, depth: 1, shape: 'square' },
        filter: lp(2600),
      }),
      layer('square', 990, 0.15, {
        tremolo: { rate: 3, depth: 1, shape: 'square' },
        filter: lp(2600),
      }),
    ],
    volume: 0.06,
    gain: {
      state: 'edge',
      points: [
        [0, 0],
        [1, 1],
      ],
    },
    fadeIn: 0.05,
    fadeOut: 0.2,
    reverb: 0.15,
  },
};
