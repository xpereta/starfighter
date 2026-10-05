import { noise, sfx, tone } from '../../audio/recipes';
import type { LoopLayer, LoopTable, SoundTable, SynthLayer } from '../../../src/render/style';

/**
 * Realistic sound design as recipes: every sound is a few layers (an oscillator or coloured noise,
 * a filter, an envelope, grit and space) summed. Levels are kept low and quiet-by-default: guns
 * are throttled by `minGap` and `maxVoices` (automatic fire must never melt into one buzz), big
 * bangs duck the loops, and everything far away is muffled, wetter and late. Edit the numbers, or
 * use the panel's Sound section.
 */

/** Things that happen out in the arena: panned, quieter, muffled, wetter and a little late with distance. */
const AROUND = {
  pan: 0.8,
  range: 1100,
  farVolume: 0.35,
  lowpass: { near: 14000, far: 1000 },
  farReverb: 0.3,
  lag: 0.15,
} as const;
/** Big events stay audible further out but still lose their top end. */
const BIG = {
  pan: 0.8,
  range: 1500,
  farVolume: 0.45,
  lowpass: { near: 16000, far: 700 },
  farReverb: 0.35,
  lag: 0.25,
} as const;

const lowpass = (freq: number, q = 0.7): SynthLayer['filter'] => ({ type: 'lowpass', freq, q });
const bandpass = (freq: number, q = 1): SynthLayer['filter'] => ({ type: 'bandpass', freq, q });

/** A low sine hit that drops in pitch: the felt part of a gun, a hit or a blast. */
const thump = (
  from: number,
  to: number,
  decay: number,
  gain: number,
  more: Partial<SynthLayer> = {},
): SynthLayer => tone('sine', from, to, decay, gain, { attack: 0.002, ...more });

/** The sharp top of a shot or an impact: a very short band of noise. */
const crack = (
  from: number,
  to: number,
  decay: number,
  gain: number,
  more: Partial<SynthLayer> = {},
): SynthLayer => noise('bandpass', from, to, decay, gain, { attack: 0.001, ...more });

/** A radio transmission starts or ends with a short squelch of band-limited noise. */
const squelch = (delay: number, decay = 0.06, gain = 0.5): SynthLayer =>
  noise('bandpass', 2400, 1700, decay, gain, { delay, attack: 0.002, distortion: 0.3 });

/** The narrow beep of a radio, through a telephone-like band. */
const beep = (freq: number, delay: number, decay = 0.07, gain = 0.5): SynthLayer =>
  tone('sine', freq, freq, decay, gain, { delay, attack: 0.005, filter: bandpass(1600, 0.8) });

/** A soft cockpit instrument tone: a sine with a quiet octave above it. */
const instrument = (
  freq: number,
  delay: number,
  decay: number,
  gain: number,
  more: Partial<SynthLayer> = {},
): SynthLayer[] => [
  tone('sine', freq, freq, decay, gain, { delay, attack: 0.012, filter: lowpass(3500), ...more }),
  tone('sine', freq * 2, freq * 2, decay * 0.6, gain * 0.15, {
    delay,
    attack: 0.012,
    filter: lowpass(5000),
  }),
];

/** A mechanical click, as in a relay or a latch. */
const click = (delay: number, gain = 0.7, decay = 0.012, centre = 3600): SynthLayer =>
  noise('bandpass', centre, centre * 0.7, decay, gain, {
    delay,
    attack: 0.001,
    filter: { type: 'bandpass', freq: centre, freqEnd: centre * 0.7, q: 2 },
  });

export const sounds: SoundTable = {
  // The player's own gun: a felt thump, a short crack, a mechanical clack and a quick decaying tail.
  // About 13 voiced shots a second at most, so automatic fire stays a rhythm and not a buzz.
  ShotFired: sfx(
    [
      thump(150, 55, 0.11, 0.9, { distortion: 0.35 }),
      tone('triangle', 260, 90, 0.07, 0.35, { attack: 0.001, filter: lowpass(1200) }),
      crack(5200, 2200, 0.035, 0.8),
      crack(1300, 900, 0.05, 0.45, { delay: 0.012, filter: bandpass(1300, 3) }),
      noise('lowpass', 1800, 250, 0.32, 0.22, { waveform: 'pink', delay: 0.02 }),
    ],
    { volume: 0.17, pitchRandom: 0.09, minGap: 0.075, maxVoices: 3, reverb: 0.1, preDelay: 0.02 },
  ),
  // A wingman's gun: lighter and further away, so it is clearly not yours.
  WingmanShotFired: sfx(
    [
      crack(6500, 3000, 0.03, 0.7),
      thump(210, 100, 0.07, 0.5, { distortion: 0.2 }),
      noise('lowpass', 2200, 400, 0.22, 0.18, { waveform: 'pink', delay: 0.015 }),
    ],
    {
      volume: 0.09,
      pitchRandom: 0.12,
      minGap: 0.11,
      maxVoices: 2,
      spatial: AROUND,
      reverb: 0.12,
      preDelay: 0.02,
    },
  ),
  // An enemy gun: slower, heavier and ringing with metal.
  EnemyShotFired: sfx(
    [
      thump(100, 40, 0.16, 0.9, { distortion: 0.45 }),
      tone('square', 230, 180, 0.09, 0.25, { filter: bandpass(900, 6), distortion: 0.3 }),
      crack(3200, 1200, 0.05, 0.6),
      noise('lowpass', 900, 180, 0.35, 0.3, { waveform: 'pink', delay: 0.02 }),
    ],
    {
      volume: 0.15,
      pitchRandom: 0.1,
      minGap: 0.14,
      maxVoices: 3,
      spatial: AROUND,
      reverb: 0.18,
      preDelay: 0.025,
    },
  ),
  // Your bullets on an enemy: a hard metal tick, a ring, a dull body and a few sparks.
  Hit: sfx(
    [
      crack(4200, 2800, 0.02, 0.9),
      tone('sine', 2300, 2100, 0.22, 0.3, { attack: 0.001 }),
      tone('sine', 3400, 3300, 0.15, 0.15, { attack: 0.001 }),
      thump(320, 150, 0.08, 0.5),
      noise('highpass', 5000, 7000, 0.12, 0.25, {
        delay: 0.01,
        tremolo: { rate: 40, depth: 0.9 },
      }),
    ],
    {
      volume: 0.17,
      pitchRandom: 0.18,
      minGap: 0.06,
      maxVoices: 3,
      spatial: AROUND,
      reverb: 0.1,
    },
  ),
  // Hull damage on the player: a deep thump, crunch, a shriek of bent metal and a rattle of loose parts.
  PlayerDamaged: sfx(
    [
      thump(85, 32, 0.3, 0.95, { distortion: 0.5 }),
      noise('lowpass', 2200, 180, 0.35, 0.8, { waveform: 'pink', distortion: 0.5 }),
      noise('bandpass', 1100, 700, 0.5, 0.28, {
        waveform: 'noise',
        delay: 0.02,
        filter: { type: 'bandpass', freq: 1100, freqEnd: 700, q: 8 },
        tremolo: { rate: 11, depth: 0.6 },
      }),
      noise('bandpass', 3000, 2000, 0.5, 0.2, {
        delay: 0.1,
        tremolo: { rate: 22, depth: 0.9 },
      }),
    ],
    {
      volume: 0.4,
      pitchRandom: 0.1,
      minGap: 0.12,
      maxVoices: 2,
      reverb: 0.3,
      preDelay: 0.02,
      duck: { amount: 0.3, time: 0.6 },
      duckLoops: { amount: 0.6, time: 0.9 },
    },
  ),
  // A wingman is hit: a thinner metal ping, from where it is.
  WingmanHit: sfx(
    [
      crack(3000, 2200, 0.03, 0.8),
      tone('sine', 1900, 1850, 0.25, 0.3, { attack: 0.001 }),
      tone('sine', 2750, 2700, 0.18, 0.15, { attack: 0.001 }),
    ],
    {
      volume: 0.13,
      pitchRandom: 0.15,
      minGap: 0.1,
      maxVoices: 2,
      spatial: AROUND,
      reverb: 0.2,
    },
  ),
  // A wingman is shot down: a burst of radio static and a falling carrier.
  WingmanDown: sfx(
    [
      noise('bandpass', 2000, 1500, 0.5, 0.5, { distortion: 0.4, attack: 0.005 }),
      tone('sine', 700, 200, 0.8, 0.25, { attack: 0.02, filter: lowpass(1500) }),
      squelch(0.5, 0.08, 0.4),
    ],
    {
      volume: 0.22,
      maxVoices: 2,
      spatial: AROUND,
      reverb: 0.4,
      preDelay: 0.03,
      duck: { amount: 0.4, time: 1 },
    },
  ),
  // Explosions: a sub thump, a crack, a body of noise, a rattle of debris, a groan of metal, a delayed
  // secondary blast and a long dark tail. Bigger things (see `size`) are deeper and louder.
  Killed: sfx(
    [
      thump(78, 26, 0.95, 0.95, { attack: 0.004, distortion: 0.25 }),
      crack(3800, 700, 0.12, 0.9),
      noise('lowpass', 2600, 140, 1.0, 0.7, { waveform: 'pink' }),
      noise('bandpass', 3400, 1800, 0.8, 0.22, {
        delay: 0.15,
        attack: 0.04,
        tremolo: { rate: 19, depth: 0.85 },
      }),
      tone('sawtooth', 120, 55, 0.7, 0.15, {
        delay: 0.08,
        filter: lowpass(700),
        tremolo: { rate: 7, depth: 0.4 },
      }),
      thump(62, 22, 0.8, 0.6, { delay: 0.38, attack: 0.004, distortion: 0.2 }),
      crack(2600, 500, 0.09, 0.55, { delay: 0.38 }),
      noise('lowpass', 900, 120, 2.3, 0.28, { waveform: 'brown', delay: 0.1, attack: 0.15 }),
    ],
    {
      volume: 0.5,
      pitchRandom: 0.12,
      minGap: 0.06,
      maxVoices: 4,
      spatial: BIG,
      size: { ref: 26, exponent: 0.8 },
      reverb: 0.55,
      preDelay: 0.05,
      duck: { amount: 0.35, time: 0.9 },
      duckLoops: { amount: 0.55, time: 1.4 },
    },
  ),
  // A missile finds its target: the same family as an explosion, shorter and sharper.
  MissileImpact: sfx(
    [
      thump(95, 35, 0.5, 0.9, { distortion: 0.3 }),
      crack(4200, 900, 0.08, 0.9),
      noise('lowpass', 2500, 200, 0.6, 0.55, { waveform: 'pink' }),
      noise('bandpass', 3000, 1800, 0.5, 0.2, {
        delay: 0.1,
        attack: 0.03,
        tremolo: { rate: 20, depth: 0.85 },
      }),
      noise('lowpass', 800, 140, 1.4, 0.25, { waveform: 'brown', delay: 0.06, attack: 0.1 }),
    ],
    {
      volume: 0.42,
      pitchRandom: 0.1,
      minGap: 0.05,
      maxVoices: 3,
      spatial: BIG,
      reverb: 0.45,
      preDelay: 0.04,
      duckLoops: { amount: 0.4, time: 0.9 },
    },
  ),
  // Dodge roll: a rush of air and a creak of the airframe.
  EvadeStarted: sfx(
    [
      noise('bandpass', 500, 2400, 0.45, 0.6, {
        waveform: 'pink',
        attack: 0.1,
        filter: { type: 'bandpass', freq: 500, freqEnd: 2400, q: 1 },
      }),
      noise('lowpass', 300, 150, 0.4, 0.5, { waveform: 'brown', attack: 0.06 }),
      tone('sawtooth', 90, 130, 0.5, 0.08, { attack: 0.1, filter: lowpass(400) }),
    ],
    { volume: 0.3, pitchRandom: 0.1, minGap: 0.3, maxVoices: 1, reverb: 0.15 },
  ),
  // Lock-on: soft instrument tones in the cockpit, not arcade bleeps.
  LockAcquiring: sfx(instrument(1040, 0, 0.09, 0.6), {
    volume: 0.11,
    pitchRandom: 0.01,
    minGap: 0.08,
    maxVoices: 1,
  }),
  LockAcquired: sfx([...instrument(1320, 0, 0.12, 0.55), ...instrument(1760, 0.1, 0.3, 0.5)], {
    volume: 0.14,
    pitchRandom: 0.01,
    maxVoices: 1,
    reverb: 0.25,
    preDelay: 0.02,
  }),
  LockLost: sfx(
    [
      tone('sine', 780, 520, 0.22, 0.5, { attack: 0.01, filter: lowpass(2500) }),
      tone('sine', 1560, 1040, 0.12, 0.06, { attack: 0.01 }),
    ],
    { volume: 0.11, pitchRandom: 0.01, maxVoices: 1, reverb: 0.2 },
  ),
  // A salvo leaves the rails: a latch clunk, a pressure thump and a rush.
  SalvoFired: sfx(
    [
      crack(900, 700, 0.04, 0.8, { filter: bandpass(900, 3) }),
      tone('square', 140, 90, 0.05, 0.4, { filter: lowpass(900) }),
      thump(55, 35, 0.5, 0.8, { attack: 0.01, distortion: 0.2 }),
      noise('bandpass', 300, 1500, 0.7, 0.35, { waveform: 'pink', attack: 0.2 }),
    ],
    {
      volume: 0.28,
      minGap: 0.2,
      maxVoices: 2,
      reverb: 0.35,
      preDelay: 0.03,
      duckLoops: { amount: 0.3, time: 0.8 },
    },
  ),
  // One missile leaves: whoosh, motor roar, a thump, hiss, and a pass that falls in pitch as it recedes.
  MissileLaunched: sfx(
    [
      noise('bandpass', 350, 3200, 0.9, 0.7, {
        waveform: 'pink',
        attack: 0.12,
        filter: { type: 'bandpass', freq: 350, freqEnd: 3200, q: 1.2 },
      }),
      noise('lowpass', 1200, 500, 1.1, 0.5, { waveform: 'brown', attack: 0.05 }),
      thump(90, 45, 0.25, 0.7, { distortion: 0.3 }),
      noise('highpass', 5000, 8000, 0.7, 0.18, { attack: 0.15 }),
      tone('sawtooth', 380, 160, 0.8, 0.06, { delay: 0.25, filter: lowpass(900) }),
    ],
    {
      volume: 0.3,
      pitchRandom: 0.08,
      minGap: 0.08,
      maxVoices: 4,
      spatial: AROUND,
      reverb: 0.3,
      preDelay: 0.03,
    },
  ),
  // Radio: an order is a squelch, a beep and a squelch.
  OrderGiven: sfx(
    [click(0, 0.4), squelch(0, 0.04, 0.4), beep(1400, 0.03, 0.07, 0.5), squelch(0.13)],
    {
      volume: 0.2,
      maxVoices: 1,
      minGap: 0.2,
      reverb: 0.1,
      duck: { amount: 0.3, time: 0.7 },
    },
  ),
  // The battle starts: a radio call, a two-tone alert and a low swell.
  BattleStarted: sfx(
    [
      squelch(0, 0.05, 0.4),
      beep(880, 0.05, 0.14, 0.55),
      beep(660, 0.25, 0.2, 0.55),
      squelch(0.5),
      tone('sine', 48, 52, 1.8, 0.6, { attack: 0.5, detune: 8 }),
      tone('sine', 48, 52, 1.8, 0.5, { attack: 0.5, detune: -9 }),
    ],
    {
      volume: 0.2,
      maxVoices: 1,
      minGap: 1,
      reverb: 0.5,
      preDelay: 0.05,
      duck: { amount: 0.4, time: 1.2 },
    },
  ),
  // A new wave on the scope: a radar ping with a long ring and a low thud.
  WaveStarted: sfx(
    [
      tone('sine', 1500, 1480, 1.4, 0.5, { attack: 0.004 }),
      tone('sine', 3000, 2960, 0.5, 0.1, { attack: 0.004 }),
      thump(70, 50, 0.4, 0.6),
    ],
    { volume: 0.22, maxVoices: 1, minGap: 1, reverb: 0.6, preDelay: 0.06 },
  ),
  // Battle cleared: radio, then three soft tones stepping up.
  BattleCleared: sfx(
    [
      squelch(0, 0.05, 0.4),
      ...instrument(660, 0.1, 0.5, 0.5),
      ...instrument(880, 0.35, 0.55, 0.5),
      ...instrument(1320, 0.6, 1.0, 0.5),
    ],
    {
      volume: 0.24,
      maxVoices: 1,
      minGap: 1,
      reverb: 0.55,
      preDelay: 0.05,
      duck: { amount: 0.3, time: 1.2 },
    },
  ),
  // The run ends (won or lost): a low drone that swells and fades, a hush of noise under it.
  RunEnded: sfx(
    [
      tone('sine', 55, 55, 3, 0.7, { attack: 0.3, detune: 6 }),
      tone('sine', 55, 54, 3, 0.55, { attack: 0.3, detune: -7 }),
      noise('lowpass', 200, 120, 3, 0.5, { waveform: 'brown', attack: 0.5 }),
    ],
    {
      volume: 0.12,
      maxVoices: 1,
      minGap: 2,
      reverb: 0.7,
      preDelay: 0.08,
      duck: { amount: 0.6, time: 3 },
    },
  ),
  // Pilot events are radio traffic.
  PilotJoined: sfx(
    [squelch(0, 0.04, 0.4), beep(880, 0.04, 0.07, 0.5), beep(1100, 0.14, 0.1, 0.5), squelch(0.28)],
    {
      volume: 0.2,
      maxVoices: 2,
      reverb: 0.1,
      duck: { amount: 0.3, time: 0.7 },
    },
  ),
  // A pilot is lost: the transmission cuts mid-word, then a flat tone and a low thud.
  PilotLost: sfx(
    [
      noise('bandpass', 2200, 1600, 0.35, 0.6, { distortion: 0.5, attack: 0.01 }),
      tone('sine', 1000, 1000, 0.6, 0.25, { delay: 0.2, attack: 0.02, hold: 0.4 }),
      thump(60, 35, 0.3, 0.6, { delay: 0.05 }),
    ],
    {
      volume: 0.3,
      maxVoices: 2,
      reverb: 0.35,
      preDelay: 0.04,
      duck: { amount: 0.5, time: 1.2 },
    },
  ),
  PilotKill: 'silent', // the kill itself already sounds
  // A rescue pod's beacon: two soft pings, from where the pod is.
  PodSpawned: sfx(
    [
      tone('sine', 1250, 1250, 0.18, 0.5, { attack: 0.005 }),
      tone('sine', 1250, 1250, 0.18, 0.4, { attack: 0.005, delay: 0.35 }),
      tone('sine', 2500, 2500, 0.1, 0.08, { attack: 0.005 }),
    ],
    {
      volume: 0.18,
      maxVoices: 2,
      spatial: { ...AROUND, range: 3000, farVolume: 0.5 },
      reverb: 0.5,
      preDelay: 0.04,
    },
  ),
  // The pod is picked up: a docking clank, a thud and a radio beep.
  PodRescued: sfx(
    [
      noise('bandpass', 1500, 1100, 0.1, 0.8, { attack: 0.001, filter: bandpass(1500, 5) }),
      thump(180, 90, 0.2, 0.8),
      squelch(0.15, 0.04, 0.4),
      beep(1100, 0.19, 0.12, 0.5),
      squelch(0.34),
    ],
    {
      volume: 0.3,
      maxVoices: 2,
      reverb: 0.25,
      preDelay: 0.03,
      duck: { amount: 0.3, time: 0.7 },
    },
  ),
  // The pod is destroyed: static, a falling tone and a thud.
  PodLost: sfx(
    [
      noise('bandpass', 1800, 1200, 0.35, 0.5, { distortion: 0.4, attack: 0.005 }),
      tone('sine', 400, 120, 0.6, 0.3, { attack: 0.02, filter: lowpass(1200) }),
      thump(70, 35, 0.4, 0.6),
    ],
    { volume: 0.3, maxVoices: 2, reverb: 0.35, preDelay: 0.04 },
  ),
  // Arena edge: a double beep when you cross out, a soft chirp when you are back in.
  ArenaEdgeEntered: sfx(
    [
      tone('sine', 740, 740, 0.12, 0.5, { attack: 0.01, filter: lowpass(2500) }),
      tone('sine', 740, 740, 0.12, 0.5, { attack: 0.01, delay: 0.18, filter: lowpass(2500) }),
    ],
    { volume: 0.18, maxVoices: 1, minGap: 0.5, reverb: 0.15 },
  ),
  ArenaEdgeLeft: sfx(
    [tone('sine', 560, 840, 0.12, 0.45, { attack: 0.01, filter: lowpass(3000) })],
    {
      volume: 0.14,
      maxVoices: 1,
      minGap: 0.5,
    },
  ),
  // Respawn: systems coming back up, a relay click and a ready beep.
  PlayerRespawned: sfx(
    [
      tone('sine', 110, 880, 0.8, 0.35, { attack: 0.1, filter: lowpass(1800) }),
      click(0.02, 0.8),
      beep(1320, 0.6, 0.1, 0.4),
    ],
    { volume: 0.25, maxVoices: 1, minGap: 0.5, reverb: 0.3, preDelay: 0.03 },
  ),
  // Menus: tactile and quiet (a relay, a latch), never musical.
  MenuMove: sfx(
    [click(0, 0.8, 0.012, 3600), tone('sine', 1500, 1200, 0.02, 0.3, { attack: 0.001 })],
    {
      volume: 0.18,
      pitchRandom: 0.03,
      minGap: 0.04,
      maxVoices: 2,
    },
  ),
  MenuSelect: sfx(
    [
      click(0, 0.9, 0.014, 2800),
      thump(220, 120, 0.07, 0.6),
      tone('sine', 1200, 1200, 0.08, 0.3, { delay: 0.03, attack: 0.004, filter: lowpass(3000) }),
    ],
    { volume: 0.14, pitchRandom: 0.02, minGap: 0.1, maxVoices: 1 },
  ),
  MenuBack: sfx([click(0, 0.8, 0.014, 2200), thump(160, 90, 0.07, 0.55)], {
    volume: 0.12,
    pitchRandom: 0.02,
    minGap: 0.1,
    maxVoices: 1,
  }),
  MenuTick: sfx([click(0, 0.8, 0.01, 4200), click(0.03, 0.5, 0.01, 3000)], {
    volume: 0.14,
    pitchRandom: 0.02,
    minGap: 0.05,
    maxVoices: 1,
  }),
  MenuPick: sfx(
    [
      click(0, 0.8, 0.014, 2800),
      squelch(0.03, 0.04, 0.3),
      beep(1000, 0.07, 0.1, 0.5),
      squelch(0.2, 0.05, 0.3),
    ],
    {
      volume: 0.16,
      minGap: 0.1,
      maxVoices: 1,
      reverb: 0.1,
    },
  ),
  // Pause is a held breath: a short falling tone and a click; resume is the reverse.
  // Prototype 5 events: silent until the tracks give each a sound (see docs/p5-tracks.md).
  EnemySpawned: 'silent',
  EnemyMissileFired: 'silent',
  EnemyMissileHit: 'silent',
  PartDestroyed: 'silent',
  CoreExposed: 'silent',
  WingBroken: 'silent',
  CapitalDestroyed: 'silent',
  Paused: sfx(
    [tone('sine', 520, 260, 0.15, 0.5, { filter: lowpass(2000) }), click(0, 0.5, 0.012, 2500)],
    { volume: 0.15, maxVoices: 1, minGap: 0.2 },
  ),
  Resumed: sfx(
    [tone('sine', 260, 520, 0.15, 0.5, { filter: lowpass(2000) }), click(0.12, 0.5, 0.012, 2500)],
    { volume: 0.15, maxVoices: 1, minGap: 0.2 },
  ),
};

// Loops ---------------------------------------------------------------------------------------

const layer = (
  waveform: LoopLayer['waveform'],
  freq: number,
  gain: number,
  more: Partial<LoopLayer> = {},
): LoopLayer => ({
  waveform,
  freq,
  gain,
  ...more,
});

/**
 * Continuous sounds. All of them are low, so nothing continuous masks a gun or a hit: the engine is a
 * soft low rumble with a faint turbine whine, the afterburner and the rumble of speed come in only when
 * asked for, and the space bed under it all is barely there. Alarms pulse (a held tone would just be a drone).
 */
export const loops: LoopTable = {
  engine: {
    layers: [
      layer('brown', 100, 0.7, { filter: { type: 'lowpass', freq: 220, q: 0.7 } }),
      layer('sawtooth', 55, 0.22, {
        detune: 8,
        distortion: 0.15,
        filter: { type: 'lowpass', freq: 240, q: 0.7 },
      }),
      layer('sawtooth', 55, 0.22, {
        detune: -8,
        distortion: 0.15,
        filter: { type: 'lowpass', freq: 240, q: 0.7 },
      }),
      layer('triangle', 480, 0.04, { filter: { type: 'bandpass', freq: 900, q: 3 } }),
    ],
    volume: 0.036,
    gain: {
      state: 'speed',
      points: [
        [0, 0.35],
        [0.4, 0.6],
        [1, 1],
      ],
    },
    pitch: {
      state: 'speed',
      points: [
        [0, 0.8],
        [1, 1.5],
      ],
    },
    cutoff: {
      state: 'throttle',
      points: [
        [-1, 0.6],
        [0, 1],
        [1, 1.8],
      ],
    },
    fadeIn: 0.6,
    fadeOut: 0.8,
    reverb: 0.05,
  },
  afterburner: {
    layers: [
      layer('pink', 900, 0.7, { filter: { type: 'bandpass', freq: 900, q: 0.7 } }),
      layer('brown', 400, 0.7, { filter: { type: 'lowpass', freq: 400, q: 0.7 } }),
      layer('sawtooth', 70, 0.15, {
        distortion: 0.4,
        filter: { type: 'lowpass', freq: 300, q: 0.7 },
      }),
    ],
    volume: 0.06,
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
        [0.25, 0.9],
        [1, 1.3],
      ],
    },
    fadeIn: 0.35,
    fadeOut: 0.5,
    reverb: 0.08,
  },
  rumble: {
    layers: [
      layer('pink', 500, 0.8, { filter: { type: 'bandpass', freq: 500, q: 0.6 } }),
      layer('noise', 3000, 0.08, { filter: { type: 'highpass', freq: 3000, q: 0.7 } }),
    ],
    volume: 0.024,
    gain: {
      state: 'speed',
      points: [
        [0, 0],
        [0.5, 0.05],
        [1, 1],
      ],
    },
    cutoff: {
      state: 'speed',
      points: [
        [0, 0.6],
        [1, 1.8],
      ],
    },
    fadeIn: 0.8,
    fadeOut: 1,
  },
  ambient: {
    layers: [
      layer('brown', 90, 0.5, { filter: { type: 'lowpass', freq: 90, q: 0.7 } }),
      layer('sine', 41, 0.3),
      layer('sine', 41.4, 0.3),
      layer('pink', 6000, 0.05, { filter: { type: 'highpass', freq: 6000, q: 0.7 } }),
    ],
    volume: 0.015,
    gain: {
      state: 'always',
      points: [
        [0, 0],
        [1, 1],
      ],
    },
    fadeIn: 1.5,
    fadeOut: 1.5,
  },
  missiles: {
    layers: [
      layer('pink', 1800, 0.6, {
        tremolo: { rate: 14, depth: 0.2 },
        filter: { type: 'bandpass', freq: 1800, q: 1.2 },
      }),
      layer('noise', 4000, 0.1, { filter: { type: 'highpass', freq: 4000, q: 0.7 } }),
    ],
    volume: 0.048,
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
    fadeOut: 0.8,
    reverb: 0.2,
  },
  rescue: {
    layers: [
      layer('sine', 880, 0.6, { filter: { type: 'lowpass', freq: 3000, q: 0.7 } }),
      layer('sine', 1320, 0.3, {
        tremolo: { rate: 3, depth: 0.5 },
        filter: { type: 'lowpass', freq: 3000, q: 0.7 },
      }),
    ],
    volume: 0.02,
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
        [1, 1.5],
      ],
    },
    fadeIn: 0.15,
    fadeOut: 0.4,
    reverb: 0.2,
  },
  hullAlarm: {
    layers: [
      layer('sine', 880, 0.5, {
        tremolo: { rate: 2.2, depth: 1, shape: 'square' },
        filter: { type: 'lowpass', freq: 2500, q: 0.7 },
      }),
      layer('sine', 1100, 0.35, {
        tremolo: { rate: 2.2, depth: 1, shape: 'square' },
        filter: { type: 'lowpass', freq: 2500, q: 0.7 },
      }),
    ],
    volume: 0.04,
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
    reverb: 0.1,
  },
  edgeAlarm: {
    layers: [
      layer('sine', 660, 0.5, {
        tremolo: { rate: 3, depth: 1, shape: 'square' },
        filter: { type: 'lowpass', freq: 2500, q: 0.7 },
      }),
      layer('sine', 990, 0.25, {
        tremolo: { rate: 3, depth: 1, shape: 'square' },
        filter: { type: 'lowpass', freq: 2500, q: 0.7 },
      }),
    ],
    volume: 0.043,
    gain: {
      state: 'edge',
      points: [
        [0, 0],
        [1, 1],
      ],
    },
    fadeIn: 0.05,
    fadeOut: 0.2,
    reverb: 0.1,
  },
};
