import { AROUND, noise, sfx, tone } from '../../audio/recipes';
import type { SoundTable, SynthLayer } from '../../../src/render/style';

/**
 * 80s anime OVA sounds: bright analogue-synth lasers, big layered explosions with crackling
 * secondary blasts, radar-style lock beeps, brass-stab fanfares and a radio squelch for orders.
 * Everything is a recipe (layers of oscillators and noise with an envelope, a sweep and a filter):
 * edit the numbers here or in the panel's Sound section.
 */

const lowpass = (freq: number, freqEnd?: number, q = 1): SynthLayer['filter'] => ({
  type: 'lowpass',
  freq,
  ...(freqEnd !== undefined ? { freqEnd } : {}),
  q,
});

/** A synth-brass stab: detuned saw pair with a filter that opens then closes. */
const stab = (freq: number, decay: number, delay = 0): SynthLayer[] => [
  tone('sawtooth', freq, freq, decay, 0.45, {
    delay,
    attack: 0.012,
    filter: lowpass(500, 3200, 3),
  }),
  tone('sawtooth', freq * 1.007, freq * 1.007, decay, 0.4, {
    delay,
    attack: 0.012,
    filter: lowpass(500, 3200, 3),
  }),
];

export const sounds: SoundTable = {
  // A zappy laser: a falling saw "pew", a bright square layer a hair later and a tiny click.
  ShotFired: sfx(
    [
      tone('sawtooth', 2200, 260, 0.13, 0.45, { filter: { type: 'highpass', freq: 300, q: 2 } }),
      tone('square', 1100, 140, 0.1, 0.25, { delay: 0.006, filter: lowpass(4000) }),
      noise('highpass', 6000, 3000, 0.02, 0.3),
    ],
    { volume: 0.22, pitchRandom: 0.12, minGap: 0.045, maxVoices: 5, spatial: AROUND },
  ),
  // A metallic ping on impact.
  Hit: sfx(
    [
      noise('bandpass', 3500, 900, 0.08, 0.7),
      tone('square', 1800, 700, 0.07, 0.3),
      tone('sine', 260, 90, 0.12, 0.55),
    ],
    { volume: 0.34, minGap: 0.04, maxVoices: 4, spatial: AROUND },
  ),
  // The big one: a flash crack, a sub boom, a rumble, and two delayed crackles (secondary blasts).
  Killed: sfx(
    [
      noise('highpass', 5000, 1500, 0.1, 0.8),
      noise('lowpass', 3200, 120, 0.9, 0.9, { attack: 0.01 }),
      tone('sine', 110, 28, 0.9, 1, { attack: 0.01 }),
      noise('bandpass', 1500, 300, 0.25, 0.6, { delay: 0.16 }),
      tone('sine', 90, 30, 0.35, 0.6, { delay: 0.16 }),
      noise('bandpass', 1200, 250, 0.3, 0.45, { delay: 0.34 }),
    ],
    {
      volume: 0.62,
      pitchRandom: 0.15,
      minGap: 0.06,
      maxVoices: 4,
      spatial: { pan: 0.85, range: 1300, farVolume: 0.4 },
      size: { ref: 26, exponent: 0.9 },
      duck: { amount: 0.4, time: 0.9 },
    },
  ),
  // A rising whoosh with a doppler-ish sweep.
  EvadeStarted: sfx(
    [
      noise('bandpass', 300, 5000, 0.35, 0.7, {
        attack: 0.1,
        filter: { type: 'bandpass', freq: 300, freqEnd: 5000, q: 3 },
      }),
      tone('sawtooth', 180, 700, 0.3, 0.2, { attack: 0.1, filter: lowpass(1000) }),
    ],
    { volume: 0.3, minGap: 0.3, maxVoices: 1 },
  ),
  // Radar-style lock: a short high square blip, a double blip when locked, a falling tone when lost.
  LockAcquiring: sfx([tone('square', 1760, 1760, 0.045, 0.4, { filter: lowpass(5000) })], {
    volume: 0.18,
    minGap: 0.08,
    maxVoices: 1,
  }),
  LockAcquired: sfx(
    [
      tone('square', 1760, 1760, 0.06, 0.4, { filter: lowpass(5000) }),
      tone('square', 2349, 2349, 0.06, 0.4, { delay: 0.08, filter: lowpass(5000) }),
      tone('square', 2349, 2349, 0.16, 0.4, { delay: 0.16, filter: lowpass(5000) }),
    ],
    { volume: 0.26, maxVoices: 2 },
  ),
  LockLost: sfx([tone('square', 1400, 350, 0.3, 0.4, { filter: lowpass(3000, 600) })], {
    volume: 0.2,
    maxVoices: 2,
  }),
  // Salvo: the pods open with a rising thump and a long hiss.
  SalvoFired: sfx(
    [
      tone('sine', 70, 160, 0.3, 0.9, { attack: 0.02 }),
      noise('bandpass', 500, 3500, 0.7, 0.8, {
        attack: 0.15,
        filter: { type: 'bandpass', freq: 500, freqEnd: 3500, q: 2 },
      }),
      tone('sawtooth', 160, 480, 0.6, 0.35, { attack: 0.15, filter: lowpass(800, 3000) }),
    ],
    { volume: 0.42, minGap: 0.2, maxVoices: 2 },
  ),
  // One missile: a rocket ignition whoosh that climbs away.
  MissileLaunched: sfx(
    [
      noise('lowpass', 800, 5000, 0.5, 0.8, { attack: 0.03 }),
      tone('sawtooth', 120, 600, 0.5, 0.4, { filter: lowpass(900, 3500, 2) }),
      tone('sine', 60, 120, 0.2, 0.7),
    ],
    { volume: 0.36, minGap: 0.08, spatial: AROUND },
  ),
  // Radio squelch: a short noise burst then two chirps.
  OrderGiven: sfx(
    [
      noise('bandpass', 2400, 2400, 0.05, 0.5),
      tone('square', 1320, 1320, 0.05, 0.3, { delay: 0.05, filter: lowpass(3000) }),
      tone('square', 1760, 1760, 0.07, 0.3, { delay: 0.12, filter: lowpass(3000) }),
    ],
    { volume: 0.22, maxVoices: 1, minGap: 0.2 },
  ),
  // Battle start: a brass stab chord (A minor, then up a step).
  BattleStarted: sfx(
    [...stab(220, 0.7), ...stab(261.6, 0.7), ...stab(329.6, 0.7), ...stab(293.7, 0.9, 0.3)],
    {
      volume: 0.3,
      maxVoices: 1,
      minGap: 1,
    },
  ),
  // Next wave: a low warning swell.
  WaveStarted: sfx(
    [
      tone('sawtooth', 82, 110, 0.7, 0.6, { attack: 0.2, filter: lowpass(300, 900, 4) }),
      tone('square', 164, 220, 0.7, 0.2, { attack: 0.2, filter: lowpass(500) }),
    ],
    { volume: 0.3, maxVoices: 1, minGap: 1 },
  ),
  // Battle cleared: a rising brass fanfare.
  BattleCleared: sfx(
    [
      ...stab(261.6, 0.3),
      ...stab(329.6, 0.3, 0.15),
      ...stab(392, 0.3, 0.3),
      ...stab(523.3, 1.1, 0.45),
    ],
    {
      volume: 0.32,
      maxVoices: 1,
      minGap: 1,
    },
  ),
  // Run ended: a long, wide pad (neither triumphant nor sad, the menu says which).
  RunEnded: sfx(
    [
      tone('sawtooth', 130.8, 130, 2.2, 0.4, { attack: 0.3, filter: lowpass(500, 1400) }),
      tone('sawtooth', 196, 195, 2.2, 0.3, { attack: 0.3, filter: lowpass(500, 1400) }),
      tone('triangle', 392, 390, 2.2, 0.2, { attack: 0.4 }),
    ],
    { volume: 0.4, maxVoices: 1, minGap: 2 },
  ),
  PilotJoined: sfx(
    [
      tone('square', 880, 880, 0.08, 0.35, { filter: lowpass(4000) }),
      tone('square', 1320, 1320, 0.2, 0.35, { delay: 0.08, filter: lowpass(4000) }),
    ],
    { volume: 0.28, maxVoices: 2 },
  ),
  // A pilot is gone: a slow falling minor pair with a low thud.
  PilotLost: sfx(
    [
      tone('triangle', 440, 220, 0.8, 0.6, { attack: 0.02 }),
      tone('triangle', 349, 175, 0.8, 0.5, { delay: 0.14, attack: 0.02 }),
      tone('sine', 65, 40, 0.5, 0.7),
    ],
    { volume: 0.42, maxVoices: 2, duck: { amount: 0.5, time: 1.4 } },
  ),
  PilotKill: 'silent', // the kill itself already sounds
  // A pod's distress beacon: two soft pings.
  PodSpawned: sfx(
    [tone('sine', 1568, 1568, 0.4, 0.5), tone('sine', 2093, 2093, 0.4, 0.35, { delay: 0.18 })],
    { volume: 0.22, maxVoices: 2, spatial: AROUND },
  ),
  PodRescued: sfx(
    [
      tone('triangle', 784, 784, 0.12, 0.5),
      tone('triangle', 1047, 1047, 0.12, 0.5, { delay: 0.1 }),
      tone('triangle', 1568, 1568, 0.45, 0.5, { delay: 0.2 }),
    ],
    { volume: 0.38, maxVoices: 2 },
  ),
  PodLost: sfx(
    [
      noise('lowpass', 1500, 150, 0.5, 0.7),
      tone('sawtooth', 300, 60, 0.6, 0.5, { filter: lowpass(900, 200) }),
    ],
    { volume: 0.35, maxVoices: 2 },
  ),
  Paused: sfx([tone('square', 880, 440, 0.12, 0.4, { filter: lowpass(3000) })], {
    volume: 0.26,
    maxVoices: 1,
    minGap: 0.2,
  }),
  Resumed: sfx([tone('square', 440, 880, 0.12, 0.4, { filter: lowpass(3000) })], {
    volume: 0.26,
    maxVoices: 1,
    minGap: 0.2,
  }),
};
