import { noise, sfx, tone } from '../../audio/recipes';
import type { SoundTable, SynthLayer } from '../../../src/render/style';

export { loops } from './loops';
export { music } from './music';

/**
 * The spectacular pack's sound effects: the 80s/90s anime space-opera played big. Every guns,
 * explosions and missile sound is several layers (a sharp crack, a body, a sub hit, debris, a long
 * tail) sent through the shared reverb with distance cues (far things are muffled, wetter and late);
 * the radio is a squelch, a voice-like formant mumble and a beep; big events dip the music and the
 * engine loops so they breathe around them. Everything is a recipe: edit the numbers here or in the
 * panel's Sound section. Written by ear-less reasoning and level measurement only: nobody has
 * listened to it yet.
 */

/** Things out in the arena: panned, quieter, muffled, wetter and a little late with distance. */
const AROUND = {
  pan: 0.85,
  range: 1100,
  farVolume: 0.35,
  lowpass: { near: 16000, far: 900 },
  farReverb: 0.35,
  lag: 0.15,
} as const;
/** Big events carry further but lose their top end. */
const BIG = {
  pan: 0.85,
  range: 1600,
  farVolume: 0.5,
  lowpass: { near: 18000, far: 650 },
  farReverb: 0.4,
  lag: 0.3,
} as const;

const lowpass = (freq: number, freqEnd?: number, q = 0.8): SynthLayer['filter'] => ({
  type: 'lowpass',
  freq,
  ...(freqEnd !== undefined ? { freqEnd } : {}),
  q,
});
const bandpass = (freq: number, freqEnd?: number, q = 1): SynthLayer['filter'] => ({
  type: 'bandpass',
  freq,
  ...(freqEnd !== undefined ? { freqEnd } : {}),
  q,
});

/** A low sine hit that falls in pitch: the felt part of a gun, a hit or a blast. */
const thump = (
  from: number,
  to: number,
  decay: number,
  gain: number,
  more: Partial<SynthLayer> = {},
): SynthLayer => tone('sine', from, to, decay, gain, { attack: 0.003, ...more });

/** The sharp top of a shot or an impact: a very short band of noise. */
const crack = (
  from: number,
  to: number,
  decay: number,
  gain: number,
  more: Partial<SynthLayer> = {},
): SynthLayer => noise('bandpass', from, to, decay, gain, { attack: 0.001, ...more });

/** Coloured rumble: brown noise through a falling low-pass (fire, engines, a tail). */
const roar = (
  from: number,
  to: number,
  decay: number,
  gain: number,
  more: Partial<SynthLayer> = {},
): SynthLayer =>
  noise('lowpass', from, to, decay, gain, { waveform: 'brown', attack: 0.02, ...more });

/** A radio key-up or key-down: a burst of band-limited, gritty noise. */
const squelch = (delay: number, decay = 0.07, gain = 0.5): SynthLayer =>
  noise('bandpass', 2400, 1700, decay, gain, { delay, attack: 0.002, distortion: 0.4 });

/** The narrow beep that ends a transmission, through a telephone-like band. */
const beep = (freq: number, delay: number, decay = 0.08, gain = 0.4): SynthLayer =>
  tone('sine', freq, freq, decay, gain, {
    delay,
    attack: 0.004,
    filter: bandpass(1700, undefined, 0.8),
  });

/**
 * A voice-like mumble: a buzzy glottal source (a saw at `base` Hz that falls) through three
 * resonances that glide (the formants: f1 and f2 move, f3 stays), chopped at a syllable rate. No words,
 * only the texture of someone talking over a radio. The sound's pitch (its random spread) moves the
 * source and the formants together, so each play sounds like another speaker.
 */
const VOICE_BOOST = 1.6; // the narrow resonances throw most of the saw's energy away: make up for it
const mumble = (
  delay: number,
  seconds: number,
  base: number,
  f1: readonly [number, number],
  f2: readonly [number, number],
  gain = 1,
  rate = 5.5,
): SynthLayer[] => [
  tone('sawtooth', base, base * 0.82, seconds, 0.5 * gain * VOICE_BOOST, {
    delay,
    attack: 0.03,
    distortion: 0.2,
    tremolo: { rate, depth: 0.9 },
    filter: bandpass(f1[0], f1[1], 2.2),
  }),
  tone('sawtooth', base * 1.006, base * 0.826, seconds, 0.4 * gain * VOICE_BOOST, {
    delay,
    attack: 0.03,
    tremolo: { rate, depth: 0.85 },
    filter: bandpass(f2[0], f2[1], 2.8),
  }),
  tone('sawtooth', base * 0.997, base * 0.815, seconds, 0.22 * gain * VOICE_BOOST, {
    delay,
    attack: 0.03,
    tremolo: { rate: rate * 1.05, depth: 0.8 },
    filter: bandpass(2700, 2500, 3.5),
  }),
  noise('bandpass', 1800, 2200, seconds, 0.09 * gain * VOICE_BOOST, {
    delay,
    attack: 0.03,
    waveform: 'pink',
    tremolo: { rate, depth: 0.9 },
  }),
];

/** A ringing metal partial: two inharmonic sines. */
const ring = (freq: number, delay: number, decay: number, gain: number): SynthLayer[] => [
  tone('sine', freq, freq, decay, gain, { delay, attack: 0.002 }),
  tone('sine', freq * 2.76, freq * 2.76, decay * 0.6, gain * 0.4, { delay, attack: 0.002 }),
];

export const sounds: Partial<SoundTable> = {
  // The player's cannon: a crack, a zap, a thump you feel and a little air; a short tail in the space.
  ShotFired: sfx(
    [
      crack(3600, 1400, 0.04, 0.8),
      tone('sawtooth', 2600, 300, 0.11, 0.5, {
        distortion: 0.3,
        filter: { type: 'highpass', freq: 400, q: 1.5 },
      }),
      thump(170, 55, 0.11, 0.8, { attack: 0.001 }),
      tone('square', 900, 200, 0.03, 0.25, { attack: 0.001, filter: lowpass(4000) }),
      noise('highpass', 2500, 1500, 0.2, 0.15, { delay: 0.02, waveform: 'pink' }),
    ],
    { volume: 0.36, pitchRandom: 0.07, minGap: 0.1, maxVoices: 3, reverb: 0.22, preDelay: 0.012 },
  ),
  // Enemy guns: harsher and lower, further out and muffled.
  EnemyShotFired: sfx(
    [
      crack(2200, 800, 0.08, 0.7),
      tone('square', 1400, 200, 0.15, 0.4, { distortion: 0.25, filter: lowpass(3500, 700, 3) }),
      thump(120, 50, 0.12, 0.7),
    ],
    {
      volume: 0.22,
      pitchRandom: 0.1,
      minGap: 0.14,
      maxVoices: 3,
      spatial: AROUND,
      reverb: 0.2,
      preDelay: 0.015,
    },
  ),
  // Wingmen: a lighter, brighter pew.
  WingmanShotFired: sfx(
    [
      crack(4200, 1800, 0.035, 0.6),
      tone('sawtooth', 3200, 380, 0.09, 0.45, { filter: { type: 'highpass', freq: 500, q: 1.5 } }),
      thump(210, 80, 0.07, 0.5),
    ],
    {
      volume: 0.16,
      pitchRandom: 0.12,
      minGap: 0.14,
      maxVoices: 2,
      spatial: AROUND,
      reverb: 0.15,
    },
  ),
  // Your bullets landing: a metallic crunch and a ring.
  Hit: sfx(
    [
      crack(4000, 1200, 0.07, 0.7),
      ...ring(1900, 0, 0.3, 0.25),
      thump(220, 90, 0.09, 0.55),
      tone('square', 1700, 600, 0.05, 0.2, { filter: lowpass(4500) }),
    ],
    { volume: 0.34, minGap: 0.04, maxVoices: 4, spatial: AROUND, reverb: 0.18 },
  ),
  // The big one: flash, thump, sub, fireball roar, debris crackles, secondary blasts and a rolling tail.
  Killed: sfx(
    [
      noise('highpass', 6000, 1500, 0.14, 0.7, { attack: 0.001 }),
      thump(130, 34, 0.9, 0.9, { distortion: 0.35, attack: 0.004, hold: 0.04 }),
      thump(58, 22, 2.4, 0.8, { delay: 0.02, attack: 0.012, hold: 0.12 }),
      roar(2800, 120, 1.8, 0.9, { hold: 0.15 }),
      crack(5200, 2400, 0.4, 0.22, {
        delay: 0.05,
        filter: { type: 'bandpass', freq: 5200, freqEnd: 2400, q: 6 },
      }),
      crack(2000, 400, 0.25, 0.55, { delay: 0.12 }),
      thump(92, 30, 0.6, 0.6, { delay: 0.18, distortion: 0.3 }),
      crack(1500, 300, 0.3, 0.45, { delay: 0.3 }),
      crack(1200, 250, 0.35, 0.35, { delay: 0.5 }),
      noise('lowpass', 900, 80, 3.2, 0.5, {
        waveform: 'pink',
        delay: 0.15,
        attack: 0.3,
        hold: 0.3,
      }),
    ],
    {
      volume: 0.62,
      pitchRandom: 0.14,
      minGap: 0.06,
      maxVoices: 4,
      spatial: BIG,
      size: { ref: 26, exponent: 0.9 },
      duck: { amount: 0.6, time: 1.6 },
      duckLoops: { amount: 0.55, time: 1.2 },
      reverb: 0.5,
      preDelay: 0.035,
    },
  ),
  // A missile hit: a smaller blast with the same shape.
  MissileImpact: sfx(
    [
      noise('highpass', 6000, 1800, 0.1, 0.65, { attack: 0.001 }),
      thump(110, 34, 0.7, 0.9, { distortion: 0.3, hold: 0.03 }),
      roar(2400, 140, 1.1, 0.8, { hold: 0.08 }),
      crack(1800, 350, 0.25, 0.5, { delay: 0.1 }),
      thump(80, 30, 0.5, 0.55, { delay: 0.16 }),
      noise('lowpass', 800, 90, 1.9, 0.4, { waveform: 'pink', delay: 0.1, attack: 0.15 }),
    ],
    {
      volume: 0.5,
      pitchRandom: 0.12,
      minGap: 0.05,
      maxVoices: 4,
      spatial: BIG,
      duck: { amount: 0.4, time: 1.0 },
      reverb: 0.42,
      preDelay: 0.03,
    },
  ),
  // Your hull is hit: a deep thud, a metal crunch and a screech of tearing plate; dips music and engine.
  PlayerDamaged: sfx(
    [
      thump(95, 38, 0.55, 1, { distortion: 0.5, hold: 0.04 }),
      crack(900, 250, 0.3, 0.7, { distortion: 0.3 }),
      noise('highpass', 5000, 2000, 0.08, 0.5, { attack: 0.001 }),
      tone('square', 190, 90, 0.2, 0.4, { distortion: 0.4, filter: lowpass(1200) }),
      tone('sawtooth', 1500, 400, 0.28, 0.25, { delay: 0.03, filter: bandpass(1400, 500, 8) }),
      roar(600, 80, 0.7, 0.6, { delay: 0.05 }),
    ],
    {
      volume: 0.58,
      pitchRandom: 0.08,
      minGap: 0.12,
      maxVoices: 3,
      reverb: 0.35,
      preDelay: 0.02,
      duck: { amount: 0.5, time: 1.0 },
      duckLoops: { amount: 0.4, time: 0.7 },
    },
  ),
  WingmanHit: sfx(
    [crack(3000, 900, 0.07, 0.6), ...ring(1500, 0, 0.2, 0.2), thump(180, 80, 0.08, 0.45)],
    { volume: 0.3, minGap: 0.1, maxVoices: 2, spatial: AROUND, reverb: 0.15 },
  ),
  // A wingman is lost: a small blast and a cut-off radio cry.
  WingmanDown: sfx(
    [
      crack(2600, 500, 0.3, 0.6),
      thump(120, 35, 0.6, 0.8, { distortion: 0.3 }),
      roar(1800, 130, 0.9, 0.6),
      squelch(0.15, 0.06, 0.45),
      ...mumble(0.2, 0.28, 190, [800, 520], [1700, 2100], 0.9, 6.5),
      noise('highpass', 3000, 1500, 0.3, 0.3, { delay: 0.5, distortion: 0.5 }),
    ],
    {
      volume: 0.55,
      maxVoices: 2,
      minGap: 0.3,
      spatial: AROUND,
      reverb: 0.3,
      duck: { amount: 0.3, time: 0.9 },
    },
  ),
  // Dodge: a rising pass-by and a falling one right behind it (doppler).
  EvadeStarted: sfx(
    [
      noise('bandpass', 200, 6500, 0.35, 0.8, {
        attack: 0.12,
        filter: { type: 'bandpass', freq: 200, freqEnd: 6500, q: 4 },
      }),
      noise('bandpass', 6000, 350, 0.45, 0.6, {
        delay: 0.3,
        attack: 0.02,
        filter: { type: 'bandpass', freq: 6000, freqEnd: 350, q: 3 },
      }),
      tone('sawtooth', 160, 900, 0.3, 0.2, { attack: 0.1, filter: lowpass(1200) }),
      thump(70, 45, 0.3, 0.4, { delay: 0.28 }),
    ],
    { volume: 0.5, minGap: 0.3, maxVoices: 1, reverb: 0.3, preDelay: 0.01 },
  ),
  // Lock-on: a radar tick, a ringing lock-tone triple, a falling loss.
  LockAcquiring: sfx(
    [
      tone('sine', 1760, 1760, 0.06, 0.45, { filter: lowpass(5000) }),
      noise('highpass', 6000, 6000, 0.012, 0.25, { attack: 0.001 }),
    ],
    { volume: 0.32, minGap: 0.08, maxVoices: 1, reverb: 0.15 },
  ),
  LockAcquired: sfx(
    [
      tone('square', 1760, 1760, 0.06, 0.35, { filter: lowpass(5000) }),
      tone('square', 2349, 2349, 0.06, 0.35, { delay: 0.08, filter: lowpass(5000) }),
      tone('square', 2349, 2349, 0.22, 0.35, { delay: 0.16, filter: lowpass(5000) }),
      ...ring(1760, 0.16, 0.7, 0.25),
      thump(130, 80, 0.12, 0.3, { delay: 0.16 }),
    ],
    { volume: 0.4, maxVoices: 2, reverb: 0.3, preDelay: 0.02 },
  ),
  LockLost: sfx(
    [
      tone('square', 1500, 330, 0.34, 0.4, { filter: lowpass(3000, 500) }),
      noise('bandpass', 3000, 600, 0.2, 0.2),
    ],
    { volume: 0.35, maxVoices: 2, reverb: 0.2 },
  ),
  // The missile swarm: a pod thunk, three overlapping whooshes, a rising saw and a long hiss, with clunks.
  SalvoFired: sfx(
    [
      thump(55, 150, 0.4, 0.9, { attack: 0.03, distortion: 0.2 }),
      noise('bandpass', 400, 4500, 0.8, 0.8, {
        attack: 0.12,
        filter: { type: 'bandpass', freq: 400, freqEnd: 4500, q: 2 },
      }),
      noise('bandpass', 600, 5500, 0.8, 0.7, {
        delay: 0.12,
        attack: 0.1,
        filter: { type: 'bandpass', freq: 600, freqEnd: 5500, q: 2 },
      }),
      noise('bandpass', 300, 3800, 0.9, 0.65, {
        delay: 0.26,
        attack: 0.12,
        waveform: 'pink',
        filter: { type: 'bandpass', freq: 300, freqEnd: 3800, q: 1.6 },
      }),
      tone('sawtooth', 120, 520, 0.7, 0.3, {
        attack: 0.2,
        distortion: 0.25,
        filter: lowpass(800, 3200),
      }),
      noise('highpass', 5000, 3000, 1.2, 0.22, { attack: 0.25, delay: 0.1 }),
      tone('square', 260, 120, 0.05, 0.3, { attack: 0.002 }),
      tone('square', 240, 110, 0.05, 0.3, { delay: 0.1, attack: 0.002 }),
      tone('square', 220, 100, 0.05, 0.3, { delay: 0.2, attack: 0.002 }),
    ],
    {
      volume: 0.5,
      minGap: 0.25,
      maxVoices: 2,
      reverb: 0.45,
      preDelay: 0.02,
      duckLoops: { amount: 0.3, time: 0.8 },
    },
  ),
  // One missile: ignition whoosh that climbs away.
  MissileLaunched: sfx(
    [
      noise('lowpass', 900, 5500, 0.6, 0.8, { attack: 0.04 }),
      tone('sawtooth', 130, 650, 0.55, 0.4, { distortion: 0.2, filter: lowpass(1200, 4000, 2) }),
      thump(70, 130, 0.22, 0.7),
      noise('highpass', 4000, 6000, 0.5, 0.2, { delay: 0.05, attack: 0.1 }),
    ],
    { volume: 0.36, minGap: 0.08, maxVoices: 3, spatial: AROUND, reverb: 0.32 },
  ),
  // Squadron orders: a radio call.
  OrderGiven: sfx(
    [
      squelch(0, 0.06, 0.5),
      ...mumble(0.07, 0.32, 125, [650, 440], [1500, 2100], 0.9),
      beep(1500, 0.42, 0.07, 0.35),
      squelch(0.5, 0.07, 0.4),
    ],
    {
      volume: 0.6,
      pitchRandom: 0.14,
      maxVoices: 1,
      minGap: 0.25,
      reverb: 0.12,
      duck: { amount: 0.3, time: 0.9 },
    },
  ),
  // Battle start: a rising sweep into a huge hit, a metal clang and a radio call.
  BattleStarted: sfx(
    [
      noise('bandpass', 250, 6500, 0.15, 0.7, {
        attack: 0.9,
        filter: { type: 'bandpass', freq: 250, freqEnd: 6500, q: 3 },
      }),
      thump(80, 28, 2.6, 1, { delay: 0.95, distortion: 0.25, hold: 0.1 }),
      noise('highpass', 6000, 1500, 0.3, 0.7, { delay: 0.95, attack: 0.001 }),
      roar(2400, 90, 2.0, 0.6, { delay: 0.95, hold: 0.1 }),
      ...ring(220, 0.95, 1.6, 0.3),
      squelch(1.45, 0.06, 0.4),
      ...mumble(1.52, 0.4, 135, [700, 480], [1500, 1900], 0.8),
    ],
    {
      volume: 0.55,
      maxVoices: 1,
      minGap: 1,
      reverb: 0.55,
      preDelay: 0.04,
      duckLoops: { amount: 0.4, time: 2 },
    },
  ),
  // A new wave: a klaxon horn in three blasts over a sub swell, then a radio call.
  WaveStarted: sfx(
    [
      tone('sawtooth', 392, 392, 0.12, 0.45, {
        hold: 0.22,
        attack: 0.02,
        filter: lowpass(1600, 900, 2),
      }),
      tone('sawtooth', 294, 294, 0.12, 0.45, {
        delay: 0.45,
        hold: 0.22,
        attack: 0.02,
        filter: lowpass(1600, 900, 2),
      }),
      tone('sawtooth', 392, 392, 0.12, 0.45, {
        delay: 0.9,
        hold: 0.22,
        attack: 0.02,
        filter: lowpass(1600, 900, 2),
      }),
      thump(45, 50, 0.9, 0.9, { attack: 0.5, hold: 0.5, distortion: 0.15 }),
      squelch(1.45, 0.06, 0.4),
      ...mumble(1.52, 0.38, 150, [720, 500], [1600, 2000], 0.8, 6),
    ],
    {
      volume: 0.3,
      maxVoices: 1,
      minGap: 1,
      reverb: 0.4,
      preDelay: 0.03,
      duck: { amount: 0.35, time: 1.5 },
    },
  ),
  // Battle cleared: a shimmering rising sweep and a cheerful radio call.
  BattleCleared: sfx(
    [
      tone('sine', 800, 3200, 0.8, 0.28, { attack: 0.5 }),
      tone('triangle', 1200, 4800, 0.8, 0.18, { attack: 0.5, delay: 0.05 }),
      ...ring(1568, 0.55, 1.3, 0.3),
      thump(55, 40, 1.2, 0.6, { delay: 0.5 }),
      squelch(0.9, 0.06, 0.4),
      ...mumble(0.97, 0.4, 170, [780, 600], [1700, 2200], 0.8, 6),
      beep(1700, 1.4, 0.08, 0.35),
    ],
    { volume: 0.4, maxVoices: 1, minGap: 1, reverb: 0.55, preDelay: 0.03 },
  ),
  // The run ends: a very large boom and a long wash.
  RunEnded: sfx(
    [
      thump(70, 24, 3, 1, { distortion: 0.2, hold: 0.2 }),
      roar(1800, 70, 3.2, 0.6, { attack: 0.1 }),
      noise('lowpass', 600, 80, 4, 0.5, { waveform: 'pink', attack: 0.8, delay: 0.3 }),
      ...ring(165, 0, 3, 0.2),
    ],
    { volume: 0.4, maxVoices: 1, minGap: 2, reverb: 0.7, preDelay: 0.05 },
  ),
  // Pilots: radio chirps and calls.
  PilotJoined: sfx(
    [
      squelch(0, 0.05, 0.45),
      ...mumble(0.06, 0.3, 160, [700, 560], [1650, 2150], 0.85, 6.2),
      beep(1300, 0.4, 0.06, 0.35),
      beep(1700, 0.47, 0.1, 0.35),
      squelch(0.6, 0.06, 0.35),
    ],
    {
      volume: 0.6,
      pitchRandom: 0.14,
      maxVoices: 2,
      reverb: 0.15,
      duck: { amount: 0.3, time: 0.8 },
    },
  ),
  // A pilot is gone: a low falling tone, a dying radio and static.
  PilotLost: sfx(
    [
      thump(90, 40, 1.4, 0.8, { attack: 0.01, hold: 0.1 }),
      tone('triangle', 330, 165, 1.2, 0.4, { attack: 0.02, filter: lowpass(1200) }),
      squelch(0, 0.05, 0.4),
      ...mumble(0.06, 0.35, 120, [600, 380], [1400, 1000], 0.8, 5),
      noise('highpass', 2500, 1200, 0.9, 0.35, { delay: 0.4, distortion: 0.6, waveform: 'pink' }),
      noise('bandpass', 2400, 1700, 0.08, 0.45, { delay: 0.45, distortion: 0.5 }),
    ],
    {
      volume: 0.5,
      maxVoices: 2,
      reverb: 0.4,
      preDelay: 0.03,
      duck: { amount: 0.6, time: 2 },
    },
  ),
  PilotKill: 'silent', // the kill itself already sounds
  // ---- Prototype 5: enemy variety, in the pack's cinematic voice -------------------------------------
  // A ship arrives: a short, quiet warp-in (a rising shimmer and a soft thump), many at once so it stays small.
  EnemySpawned: sfx(
    [
      noise('bandpass', 700, 5200, 0.3, 0.45, {
        attack: 0.12,
        filter: { type: 'bandpass', freq: 700, freqEnd: 5200, q: 3 },
      }),
      tone('sine', 420, 1500, 0.28, 0.2, { attack: 0.1, filter: lowpass(3500) }),
      thump(90, 45, 0.25, 0.35, { delay: 0.14 }),
    ],
    {
      volume: 0.22,
      pitchRandom: 0.15,
      minGap: 0.18,
      maxVoices: 2,
      spatial: AROUND,
      reverb: 0.3,
      preDelay: 0.02,
    },
  ),
  // An enemy missile leaves its rail: a hard launch thump, a rising ignition rush (red-alert whoosh) and a two-beep
  // warning klaxon that cuts through the mix (the audible half of the MISSILE warning).
  EnemyMissileFired: sfx(
    [
      thump(65, 150, 0.3, 0.8, { attack: 0.01, distortion: 0.25 }),
      noise('bandpass', 500, 5000, 0.7, 0.7, {
        attack: 0.15,
        filter: { type: 'bandpass', freq: 500, freqEnd: 5000, q: 2 },
      }),
      tone('sawtooth', 150, 700, 0.6, 0.3, { attack: 0.18, filter: lowpass(1400, 4000, 2) }),
      tone('square', 1320, 1320, 0.09, 0.4, { delay: 0.05, filter: lowpass(3200) }),
      tone('square', 1320, 1320, 0.09, 0.4, { delay: 0.22, filter: lowpass(3200) }),
      tone('square', 990, 990, 0.14, 0.38, { delay: 0.39, filter: lowpass(3200) }),
      noise('highpass', 4500, 6000, 0.5, 0.15, { delay: 0.1, attack: 0.15 }),
    ],
    {
      volume: 0.42,
      pitchRandom: 0.05,
      minGap: 0.3,
      maxVoices: 2,
      spatial: AROUND,
      reverb: 0.3,
      preDelay: 0.02,
      duckLoops: { amount: 0.25, time: 0.6 },
    },
  ),
  // An enemy missile ends: on you, a heavy thud and tearing noise; spent on your roll or burnt out, the same shape a lot smaller.
  EnemyMissileHit: sfx(
    [
      noise('highpass', 5500, 1800, 0.08, 0.55, { attack: 0.001 }),
      thump(100, 36, 0.6, 0.9, { distortion: 0.35, hold: 0.03 }),
      roar(2200, 150, 0.9, 0.7, { hold: 0.05 }),
      crack(1700, 330, 0.25, 0.45, { delay: 0.08 }),
      noise('lowpass', 800, 90, 1.4, 0.35, { waveform: 'pink', delay: 0.08, attack: 0.1 }),
    ],
    {
      volume: 0.46,
      pitchRandom: 0.1,
      minGap: 0.06,
      maxVoices: 3,
      spatial: BIG,
      reverb: 0.4,
      preDelay: 0.025,
      duck: { amount: 0.3, time: 0.8 },
    },
  ),
  // One part of the capital ship goes: a deep boom, a roar of fire and a metallic rain, with a rolling tail.
  PartDestroyed: sfx(
    [
      noise('highpass', 5500, 1400, 0.12, 0.65, { attack: 0.001 }),
      thump(95, 28, 1.4, 1, { distortion: 0.35, hold: 0.06 }),
      thump(52, 20, 2.0, 0.7, { delay: 0.03, attack: 0.02, hold: 0.1 }),
      roar(2400, 110, 1.6, 0.85, { hold: 0.1 }),
      crack(2100, 420, 0.3, 0.5, { delay: 0.1 }),
      ...ring(180, 0.08, 1.2, 0.22),
      crack(1400, 280, 0.35, 0.4, { delay: 0.28 }),
      noise('lowpass', 800, 70, 2.4, 0.45, { waveform: 'pink', delay: 0.15, attack: 0.25 }),
    ],
    {
      volume: 0.58,
      pitchRandom: 0.12,
      minGap: 0.1,
      maxVoices: 4,
      spatial: BIG,
      duck: { amount: 0.45, time: 1.3 },
      duckLoops: { amount: 0.4, time: 1.0 },
      reverb: 0.5,
      preDelay: 0.035,
    },
  ),
  // The core is bare: a rising two-note alarm with a gold ring and a sub swell, so the player hears "now".
  CoreExposed: sfx(
    [
      tone('square', 880, 880, 0.12, 0.35, { filter: lowpass(4200) }),
      tone('square', 1320, 1320, 0.2, 0.35, { delay: 0.14, filter: lowpass(4200) }),
      tone('square', 1760, 1760, 0.34, 0.33, { delay: 0.3, filter: lowpass(4200) }),
      ...ring(1320, 0.3, 1.0, 0.25),
      thump(60, 90, 0.5, 0.5, { attack: 0.2 }),
      noise('highpass', 5000, 6500, 0.5, 0.12, { delay: 0.3, attack: 0.1 }),
    ],
    {
      volume: 0.44,
      maxVoices: 1,
      minGap: 0.6,
      reverb: 0.35,
      preDelay: 0.02,
      duck: { amount: 0.25, time: 0.8 },
    },
  ),
  // A wing breaks formation: a cut radio call, a sharp metallic snap and a falling whistle as the line scatters.
  WingBroken: sfx(
    [
      squelch(0, 0.05, 0.4),
      crack(3200, 900, 0.1, 0.5, { delay: 0.06 }),
      ...ring(1400, 0.06, 0.4, 0.2),
      tone('sawtooth', 1800, 260, 0.45, 0.2, { delay: 0.08, filter: bandpass(1400, 500, 6) }),
      thump(140, 70, 0.15, 0.4, { delay: 0.06 }),
    ],
    { volume: 0.34, maxVoices: 1, minGap: 0.5, reverb: 0.25, preDelay: 0.015 },
  ),
  // THE finale: the capital ship ends. A held silence-breaking flash, a chest-caving sub boom, a fireball roar that lasts seconds,
  // a ring of cracks and groans as the hull folds, secondary blasts rolling over it and a very long wash. Ducks everything.
  CapitalDestroyed: sfx(
    [
      noise('highpass', 7000, 1200, 0.3, 0.8, { attack: 0.001 }),
      thump(70, 18, 3.0, 1, { distortion: 0.4, attack: 0.006, hold: 0.25 }),
      thump(40, 14, 3.4, 0.9, { delay: 0.05, attack: 0.04, hold: 0.4 }),
      roar(3200, 90, 3.2, 1, { hold: 0.4 }),
      crack(2600, 500, 0.5, 0.6, { delay: 0.12 }),
      thump(75, 24, 1.2, 0.8, { delay: 0.45, distortion: 0.35 }),
      crack(1800, 320, 0.4, 0.55, { delay: 0.6 }),
      thump(60, 20, 1.4, 0.8, { delay: 0.95, distortion: 0.35 }),
      crack(1500, 260, 0.45, 0.5, { delay: 1.2 }),
      thump(50, 18, 1.6, 0.75, { delay: 1.5, distortion: 0.3 }),
      tone('sawtooth', 220, 40, 2.2, 0.3, {
        delay: 0.3,
        attack: 0.3,
        distortion: 0.3,
        filter: lowpass(900, 120, 2),
      }),
      noise('lowpass', 1100, 50, 5.5, 0.6, {
        waveform: 'pink',
        delay: 0.3,
        attack: 0.6,
        hold: 0.8,
      }),
    ],
    {
      volume: 0.85,
      pitchRandom: 0.04,
      minGap: 2,
      maxVoices: 1,
      duck: { amount: 0.85, time: 4.5 },
      duckLoops: { amount: 0.8, time: 4 },
      reverb: 0.7,
      preDelay: 0.05,
    },
  ),
  // A pod's beacon: sonar pings in the space.
  PodSpawned: sfx(
    [
      tone('sine', 1568, 1568, 0.9, 0.5, { filter: lowpass(4000) }),
      tone('sine', 2093, 2093, 0.9, 0.35, { delay: 0.2, filter: lowpass(4500) }),
      ...ring(1046, 0.4, 0.6, 0.12),
    ],
    { volume: 0.26, maxVoices: 2, spatial: AROUND, reverb: 0.65, preDelay: 0.03 },
  ),
  PodRescued: sfx(
    [
      squelch(0, 0.05, 0.4),
      ...mumble(0.06, 0.32, 175, [760, 600], [1700, 2200], 0.8, 6.2),
      tone('triangle', 784, 784, 0.15, 0.4, { delay: 0.45 }),
      tone('triangle', 1047, 1047, 0.15, 0.4, { delay: 0.55 }),
      tone('triangle', 1568, 1568, 0.6, 0.4, { delay: 0.65 }),
    ],
    { volume: 0.55, maxVoices: 2, reverb: 0.4, duck: { amount: 0.3, time: 0.9 } },
  ),
  PodLost: sfx(
    [
      roar(1500, 150, 0.8, 0.6),
      tone('sawtooth', 300, 60, 0.9, 0.45, { filter: lowpass(900, 200) }),
      thump(80, 35, 0.6, 0.6),
    ],
    { volume: 0.35, maxVoices: 2, reverb: 0.45 },
  ),
  // The arena edge: a two-tone warning beep and the all-clear.
  ArenaEdgeEntered: sfx(
    [
      tone('square', 660, 660, 0.1, 0.4, { distortion: 0.2, filter: lowpass(2800) }),
      tone('square', 880, 880, 0.12, 0.4, { delay: 0.12, distortion: 0.2, filter: lowpass(2800) }),
      thump(100, 60, 0.15, 0.4),
    ],
    { volume: 0.28, maxVoices: 1, minGap: 0.5, reverb: 0.2 },
  ),
  ArenaEdgeLeft: sfx(
    [
      tone('triangle', 660, 990, 0.12, 0.4, { filter: lowpass(3000) }),
      ...ring(990, 0.08, 0.3, 0.15),
    ],
    { volume: 0.3, maxVoices: 1, minGap: 0.5, reverb: 0.25 },
  ),
  // Respawn: a warp-in whoosh and a soft boom.
  PlayerRespawned: sfx(
    [
      noise('bandpass', 200, 3500, 0.5, 0.7, {
        attack: 0.3,
        filter: { type: 'bandpass', freq: 200, freqEnd: 3500, q: 2.5 },
      }),
      tone('sine', 80, 420, 0.5, 0.4, { attack: 0.3 }),
      thump(70, 30, 1.2, 0.8, { delay: 0.45 }),
      ...ring(660, 0.5, 0.9, 0.2),
    ],
    { volume: 0.42, maxVoices: 1, minGap: 1, reverb: 0.5, preDelay: 0.03 },
  ),
  // Menus: soft machine ticks, a rising confirm, a lower back, a chime for a pick.
  MenuMove: sfx(
    [
      tone('triangle', 1500, 1050, 0.045, 0.4, { filter: lowpass(5000) }),
      noise('highpass', 6000, 6000, 0.01, 0.25, { attack: 0.001 }),
    ],
    { volume: 0.3, pitchRandom: 0.03, minGap: 0.05, maxVoices: 2, reverb: 0.15 },
  ),
  MenuSelect: sfx(
    [
      tone('sine', 880, 880, 0.09, 0.4, { filter: lowpass(4500) }),
      tone('sine', 1320, 1320, 0.18, 0.4, { delay: 0.07, filter: lowpass(5000) }),
      ...ring(1320, 0.07, 0.5, 0.18),
      thump(150, 90, 0.08, 0.35),
    ],
    { volume: 0.36, pitchRandom: 0.02, minGap: 0.1, maxVoices: 1, reverb: 0.3, preDelay: 0.01 },
  ),
  MenuBack: sfx(
    [tone('sine', 700, 470, 0.14, 0.4, { filter: lowpass(3500) }), thump(130, 80, 0.08, 0.3)],
    { volume: 0.3, pitchRandom: 0.02, minGap: 0.1, maxVoices: 1, reverb: 0.2 },
  ),
  MenuTick: sfx(
    [
      tone('triangle', 2200, 1800, 0.025, 0.35, { filter: lowpass(6000) }),
      tone('triangle', 2600, 2200, 0.03, 0.25, { delay: 0.04, filter: lowpass(6000) }),
    ],
    { volume: 0.25, pitchRandom: 0.02, minGap: 0.05, maxVoices: 1, reverb: 0.1 },
  ),
  MenuPick: sfx(
    [
      squelch(0, 0.04, 0.3),
      ...ring(1568, 0.04, 0.8, 0.3),
      tone('triangle', 1047, 1047, 0.1, 0.35, { delay: 0.04 }),
      tone('triangle', 1568, 1568, 0.3, 0.35, { delay: 0.12 }),
    ],
    { volume: 0.36, minGap: 0.1, maxVoices: 1, reverb: 0.4, preDelay: 0.015 },
  ),
  // Pause: a filter closing over a falling tone; resume opens it again.
  Paused: sfx(
    [
      noise('bandpass', 3500, 300, 0.25, 0.4, { attack: 0.005 }),
      tone('sine', 640, 220, 0.22, 0.4, { filter: lowpass(2500) }),
    ],
    { volume: 0.3, maxVoices: 1, minGap: 0.2, reverb: 0.25 },
  ),
  Resumed: sfx(
    [
      noise('bandpass', 300, 3500, 0.22, 0.4, { attack: 0.1 }),
      tone('sine', 220, 640, 0.2, 0.4, { attack: 0.08, filter: lowpass(2500) }),
    ],
    { volume: 0.3, maxVoices: 1, minGap: 0.2, reverb: 0.25 },
  ),
};
