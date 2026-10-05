import { noise, tone } from '../../audio/recipes';
import type { MusicDef } from '../../../src/render/style';
import type {
  Chord,
  Cue,
  DrumHit,
  DrumKit,
  Hit,
  Instrument,
  PitchedInstrument,
  ScoreDef,
  Stem,
  Stinger,
} from '../../../src/audio/score';

/**
 * The score of the spectacular pack: a synthesised, layered, adaptive 80s space-opera in A minor
 * (think synth-orchestral fanfares over a driving arpeggio, a hero theme in the lead). All of it is
 * data: instruments, drum kit, motifs, chords, stems and the rules that connect it to the game.
 *
 * How it plays (see `src/audio/README.md`, "Adaptive score"):
 *  - Flying plays the `battle` cue, an 8-bar loop over one chord progression. Its stems fade in and
 *    out with the intensity (calm patrol -> rising threat -> full battle) which the game computes from
 *    enemies alive, hull and recent action. A pad, a lone horn and a soft bass carry the patrol; a
 *    plucked arpeggio, hats, kick and driving bass join as fighters appear; brass stabs, a 16th-note
 *    arpeggio, snare, fills and the hero theme in the lead come in for a full fight. A heartbeat and a
 *    dissonant pedal rise as the hull falls; a bell line rises while a pod is being rescued.
 *  - Different cues for the Start screen (menu), the debrief and the end screen.
 *  - Stingers (battle start, wave start, threat, victory, finale, defeat, pilot lost, rescue ...)
 *    start on the next beat line, dip or cut the cue for their length, and replace lower priorities.
 *  - Everything changes on bar lines; tempo is shared by all cues so a switch is always in time.
 *
 * Pitches are whole semitones above the key (A2 = 110 Hz). A stem's `octave` shifts them.
 */

// Instruments -----------------------------------------------------------------------------------

const pitched = (i: Omit<PitchedInstrument, 'kind'>): PitchedInstrument => ({
  kind: 'pitched',
  ...i,
});

/** A slow, wide string/synth pad: three detuned saws under a soft low-pass. */
const pad = pitched({
  voices: [
    { waveform: 'sawtooth', detune: -11, gain: 0.34 },
    { waveform: 'sawtooth', detune: 0, gain: 0.3 },
    { waveform: 'sawtooth', detune: 11, gain: 0.34 },
  ],
  attack: 0.7,
  decay: 1,
  sustain: 0.85,
  release: 1.2,
  filter: { type: 'lowpass', freq: 700, freqEnd: 1500, q: 0.7, track: 0.35 },
  gain: 0.38,
});

/** Strings for stingers and swells: like the pad but brighter, with a little vibrato. */
const strings = pitched({
  voices: [
    { waveform: 'sawtooth', detune: -8, gain: 0.4 },
    { waveform: 'sawtooth', detune: 8, gain: 0.4 },
    { waveform: 'triangle', detune: 0, gain: 0.3 },
  ],
  attack: 0.35,
  decay: 0.8,
  sustain: 0.9,
  release: 0.9,
  filter: { type: 'lowpass', freq: 1200, freqEnd: 2600, q: 0.8, track: 0.4 },
  vibrato: { rate: 5, depth: 10, delay: 0.3 },
  gain: 0.36,
});

/** A deep, round bass for sustained roots. */
const subBass = pitched({
  voices: [
    { waveform: 'sine', gain: 0.85 },
    { waveform: 'triangle', gain: 0.3, octave: 1 },
  ],
  attack: 0.015,
  decay: 0.4,
  sustain: 0.75,
  release: 0.2,
  filter: { type: 'lowpass', freq: 320, q: 0.8 },
  distortion: 0.12,
  gain: 0.8,
});

/** The driving bass: a saw and a square an octave down, filtered, with a bit of bite. */
const driveBass = pitched({
  voices: [
    { waveform: 'sawtooth', gain: 0.55 },
    { waveform: 'square', gain: 0.3, octave: -1 },
  ],
  attack: 0.005,
  decay: 0.16,
  sustain: 0.55,
  release: 0.07,
  filter: { type: 'lowpass', freq: 900, freqEnd: 260, q: 3, track: 0.3 },
  distortion: 0.22,
  gain: 0.55,
});

/** A bright pluck for the arpeggio: detuned saw and square, the filter closes fast. */
const pluck = pitched({
  voices: [
    { waveform: 'sawtooth', detune: -6, gain: 0.5 },
    { waveform: 'square', detune: 6, gain: 0.25 },
  ],
  attack: 0.003,
  decay: 0.14,
  sustain: 0.18,
  release: 0.08,
  filter: { type: 'lowpass', freq: 4200, freqEnd: 800, q: 3, track: 0.5 },
  gain: 0.42,
});

/** Synth brass: three detuned saws, the filter opens as the note speaks. */
const brass = pitched({
  voices: [
    { waveform: 'sawtooth', detune: -13, gain: 0.35 },
    { waveform: 'sawtooth', detune: 0, gain: 0.35 },
    { waveform: 'sawtooth', detune: 13, gain: 0.35 },
  ],
  attack: 0.035,
  decay: 0.3,
  sustain: 0.72,
  release: 0.25,
  filter: { type: 'lowpass', freq: 600, freqEnd: 2800, q: 2.2, track: 0.5 },
  distortion: 0.1,
  gain: 0.45,
});

/** The hero lead: a thick saw and square, vibrato that blooms on long notes. */
const lead = pitched({
  voices: [
    { waveform: 'sawtooth', detune: 7, gain: 0.5 },
    { waveform: 'square', detune: -7, gain: 0.3 },
    { waveform: 'sawtooth', detune: -5, gain: 0.25, octave: 1 },
  ],
  attack: 0.02,
  decay: 0.2,
  sustain: 0.8,
  release: 0.3,
  filter: { type: 'lowpass', freq: 3200, freqEnd: 2200, q: 1.4, track: 0.5 },
  vibrato: { rate: 5.6, depth: 16, delay: 0.25 },
  distortion: 0.06,
  gain: 0.4,
});

/** A lone horn: a soft triangle and a hint of saw. */
const horn = pitched({
  voices: [
    { waveform: 'triangle', gain: 0.7 },
    { waveform: 'sawtooth', detune: 4, gain: 0.18 },
  ],
  attack: 0.12,
  decay: 0.5,
  sustain: 0.75,
  release: 0.6,
  filter: { type: 'lowpass', freq: 1500, q: 0.8, track: 0.3 },
  vibrato: { rate: 5, depth: 14, delay: 0.4 },
  gain: 0.45,
});

/** A bell: a sine with an octave and an inharmonic partial, a long ring. */
const bell = pitched({
  voices: [
    { waveform: 'sine', gain: 0.6 },
    { waveform: 'sine', gain: 0.28, octave: 1 },
    { waveform: 'sine', gain: 0.14, octave: 1.58 },
  ],
  attack: 0.002,
  decay: 1.1,
  sustain: 0,
  release: 0.8,
  gain: 0.4,
});

/** A bright siren ping for alarms in stingers. */
const alarm = pitched({
  voices: [{ waveform: 'square', gain: 0.5 }],
  attack: 0.004,
  decay: 0.1,
  sustain: 0.85,
  release: 0.08,
  filter: { type: 'lowpass', freq: 2400, q: 1 },
  gain: 0.3,
});

const kit: DrumKit = {
  kind: 'kit',
  pieces: {
    kick: {
      gain: 0.95,
      layers: [
        tone('sine', 150, 42, 0.26, 1, { attack: 0.002 }),
        tone('sine', 62, 40, 0.5, 0.6, { attack: 0.003 }),
        noise('lowpass', 3500, 500, 0.03, 0.55, { attack: 0.001 }),
      ],
    },
    snare: {
      gain: 0.85,
      layers: [
        noise('bandpass', 2200, 1100, 0.22, 0.8, { attack: 0.001 }),
        tone('triangle', 240, 150, 0.12, 0.5, { attack: 0.001 }),
        noise('highpass', 6000, 4000, 0.08, 0.3, { attack: 0.001 }),
      ],
    },
    clap: {
      gain: 0.7,
      layers: [
        noise('bandpass', 1500, 1300, 0.04, 0.7, { attack: 0.001 }),
        noise('bandpass', 1500, 1300, 0.04, 0.7, { attack: 0.001, delay: 0.011 }),
        noise('bandpass', 1500, 1200, 0.2, 0.6, { attack: 0.001, delay: 0.022 }),
      ],
    },
    hat: {
      gain: 0.55,
      layers: [noise('highpass', 7500, 9500, 0.045, 0.7, { attack: 0.001 })],
    },
    openHat: {
      gain: 0.5,
      layers: [noise('highpass', 6500, 8500, 0.24, 0.7, { attack: 0.001 })],
    },
    tom: {
      gain: 0.9,
      layers: [
        tone('sine', 200, 85, 0.32, 0.9, { attack: 0.002 }),
        noise('lowpass', 1500, 400, 0.05, 0.4, { attack: 0.001 }),
      ],
    },
    timp: {
      gain: 0.95,
      layers: [
        tone('sine', 112, 66, 1, 0.9, { attack: 0.003 }),
        tone('sine', 224, 140, 0.5, 0.3, { attack: 0.003 }),
        noise('lowpass', 700, 200, 0.09, 0.45, { attack: 0.001 }),
      ],
    },
    crash: {
      gain: 0.55,
      layers: [
        noise('highpass', 5200, 3000, 2.4, 0.7, { attack: 0.01 }),
        noise('bandpass', 7000, 4000, 1.4, 0.4, { attack: 0.01 }),
      ],
    },
    heart: {
      gain: 0.9,
      layers: [
        tone('sine', 64, 44, 0.24, 1, { attack: 0.004 }),
        tone('sine', 48, 38, 0.4, 0.7, { attack: 0.004 }),
      ],
    },
    boom: {
      gain: 0.9,
      layers: [
        tone('sine', 72, 26, 2.4, 1, { attack: 0.005 }),
        noise('lowpass', 300, 60, 1.9, 0.5, { attack: 0.01 }),
      ],
    },
    // A rising wash that peaks as it ends: place it one phrase before a big hit.
    riser: {
      gain: 0.6,
      layers: [
        noise('bandpass', 350, 7000, 0.25, 0.8, {
          attack: 1.7,
          filter: { type: 'bandpass', freq: 350, freqEnd: 7000, q: 3 },
        }),
      ],
    },
  },
};

const instruments: Record<string, Instrument> = {
  pad,
  strings,
  subBass,
  driveBass,
  pluck,
  brass,
  lead,
  horn,
  bell,
  alarm,
  kit,
};

// Harmony ---------------------------------------------------------------------------------------

/** Chords as a root (semitones above A2) and tones above it. The wide 4th tone is a 7th or a 9th. */
const Am7: Chord = { root: 0, tones: [0, 3, 7, 10] };
const Fmaj7: Chord = { root: -4, tones: [0, 4, 7, 11] };
const Cmaj7: Chord = { root: 3, tones: [0, 4, 7, 11] };
const Gadd9: Chord = { root: -2, tones: [0, 4, 7, 14] };
const Dm7: Chord = { root: 5, tones: [0, 3, 7, 10] };
const E7: Chord = { root: 7, tones: [0, 4, 7, 10] };

// Motifs (pitches above A3 when the stem plays them an octave up) ------------------------------------

const motifs: Record<string, readonly Hit[]> = {
  // The hero theme, part 1 over Am | F: a rising call and a settling answer.
  hero1: [
    [0, 12, 6, 0.95],
    [6, 15, 2],
    [8, 14, 3],
    [11, 12, 2],
    [13, 7, 3, 0.7],
    [16, 15, 6, 0.95],
    [22, 12, 2],
    [24, 12, 3],
    [27, 8, 2],
    [29, 12, 3, 0.8],
  ],
  // Part 2 over C | G: the same shape lifted.
  hero2: [
    [0, 19, 6, 0.95],
    [6, 17, 2],
    [8, 15, 4],
    [12, 12, 4, 0.8],
    [16, 14, 6, 0.95],
    [22, 10, 2],
    [24, 14, 4],
    [28, 17, 4, 0.9],
  ],
  // Part 3 over Dm | E7: the climb that leads back to the top of the loop.
  hero3: [
    [0, 17, 6, 0.95],
    [6, 15, 2],
    [8, 12, 4],
    [12, 12, 2],
    [14, 15, 2],
    [16, 14, 4, 0.95],
    [20, 11, 4],
    [24, 19, 8, 1],
  ],
  // The lone patrol horn: two long notes and a falling answer, over Am | F.
  lone: [
    [0, 7, 12, 0.7],
    [12, 10, 4, 0.6],
    [16, 8, 12, 0.7],
    [28, 7, 4, 0.6],
  ],
  // The hopeful debrief line (4 bars): up, up, a step down, and home.
  hope: [
    [0, 12, 8, 0.8],
    [8, 15, 8],
    [16, 14, 8],
    [24, 17, 8],
    [32, 19, 8, 0.9],
    [40, 15, 6],
    [48, 12, 8, 0.7],
    [56, 19, 8, 0.8],
  ],
};

// Stems -----------------------------------------------------------------------------------------

/** Notes of an arpeggio: chord degrees played one per step, `every` steps apart. */
function arp(degrees: readonly number[], every: number, length: number, velocity: number): Hit[] {
  const hits: Hit[] = [];
  for (let step = 0, i = 0; step < 16; step += every, i++) {
    const accent = step % 4 === 0 ? 1 : 0.78;
    hits.push([step, degrees[i % degrees.length]!, length, velocity * accent]);
  }
  return hits;
}

const hit = (steps: readonly number[], piece: string, velocity: number): DrumHit[] =>
  steps.map((s) => [s, piece, velocity]);

/** A full-bar chord held (degrees 0..3). */
const held = (velocity: number): Hit[] => [0, 1, 2, 3].map((d) => [0, d, 16, velocity] as Hit);

const always = { input: 'intensity', on: -0.5, full: -0.2 } as const;

const padStem: Stem = {
  id: 'pad',
  instrument: 'pad',
  volume: 0.4,
  gate: always,
  octave: 1,
  reverb: 0.6,
  pattern: { kind: 'chord', hits: held(0.7) },
};

/** Calm patrol bass: roots on the downbeat and the third beat, swelling out as the fight begins. */
const bassCalm: Stem = {
  id: 'bassCalm',
  instrument: 'subBass',
  volume: 0.5,
  gate: { input: 'intensity', on: 0.04, full: 0.15, out: 0.42, outFull: 0.58 },
  octave: -1,
  pattern: {
    kind: 'chord',
    hits: [
      [0, 0, 7, 0.9],
      [8, 0, 7, 0.75],
    ],
  },
};

const bassDrive: Stem = {
  id: 'bassDrive',
  instrument: 'driveBass',
  volume: 0.65,
  gate: { input: 'intensity', on: 0.44, full: 0.6 },
  octave: -1,
  pattern: {
    kind: 'chord',
    hits: [
      [0, 0, 2, 1],
      [2, 0, 1, 0.6],
      [3, 0, 1, 0.7],
      [4, 0, 2, 0.85],
      [6, 0, 1, 0.6],
      [8, 0, 2, 1],
      [10, 0, 1, 0.6],
      [11, 2, 1, 0.7],
      [12, 0, 2, 0.85],
      [14, 1, 1, 0.65],
      [15, 0, 1, 0.6],
    ],
  },
};

const arpCalm: Stem = {
  id: 'arpCalm',
  instrument: 'pluck',
  volume: 0.4,
  gate: { input: 'intensity', on: 0.22, full: 0.38, out: 0.62, outFull: 0.8 },
  octave: 1,
  reverb: 0.5,
  pattern: { kind: 'chord', hits: arp([0, 1, 2, 3, 2, 1], 2, 2, 0.5) },
};

const arpFast: Stem = {
  id: 'arpFast',
  instrument: 'pluck',
  volume: 0.55,
  gate: { input: 'intensity', on: 0.55, full: 0.72 },
  octave: 1,
  reverb: 0.3,
  pattern: { kind: 'chord', hits: arp([0, 1, 2, 3, 4, 3, 2, 1], 1, 1, 0.62) },
};

const brassStabs: Stem = {
  id: 'brass',
  instrument: 'brass',
  volume: 0.6,
  gate: { input: 'intensity', on: 0.7, full: 0.86 },
  octave: 1,
  reverb: 0.35,
  pattern: {
    kind: 'chord',
    hits: [0, 6, 10].flatMap((s) =>
      [0, 1, 2].map((d) => [s, d, s === 0 ? 4 : 2, s === 0 ? 1 : 0.8] as Hit),
    ),
  },
};

const horn1: Stem = {
  id: 'horn',
  instrument: 'horn',
  volume: 0.5,
  gate: { input: 'intensity', on: 0.04, full: 0.16, out: 0.34, outFull: 0.52 },
  octave: 1,
  reverb: 0.7,
  pattern: {
    kind: 'motif',
    statements: [
      { motif: 'lone', bar: 0 },
      { motif: 'lone', bar: 2, transpose: 3 },
      { motif: 'lone', bar: 4 },
    ],
  },
};

const heroLead: Stem = {
  id: 'lead',
  instrument: 'lead',
  volume: 0.7,
  gate: { input: 'intensity', on: 0.78, full: 0.92 },
  octave: 1,
  reverb: 0.5,
  pattern: {
    kind: 'motif',
    statements: [
      { motif: 'hero1', bar: 0 },
      { motif: 'hero2', bar: 2 },
      { motif: 'hero1', bar: 4 },
      { motif: 'hero3', bar: 6 },
    ],
  },
};

/** The lead's octave double, only when the fight is at its peak. */
const heroHigh: Stem = {
  id: 'leadHigh',
  instrument: 'pluck',
  volume: 0.4,
  gate: { input: 'intensity', on: 0.9, full: 0.99 },
  octave: 2,
  reverb: 0.5,
  pattern: {
    kind: 'motif',
    statements: [
      { motif: 'hero1', bar: 4 },
      { motif: 'hero3', bar: 6 },
    ],
  },
};

const drumStem = (
  id: string,
  hits: readonly DrumHit[],
  on: number,
  full: number,
  volume = 0.7,
  bars?: readonly number[],
): Stem => ({
  id,
  instrument: 'kit',
  volume,
  gate: { input: 'intensity', on, full },
  reverb: 0.12,
  pattern: bars ? { kind: 'drums', hits, bars } : { kind: 'drums', hits },
});

const hatsStem = drumStem(
  'hats',
  [...hit([0, 4, 8, 12], 'hat', 0.4), ...hit([2, 6, 10, 14], 'hat', 0.62)],
  0.38,
  0.5,
  0.55,
);
const hats16Stem = drumStem('hats16', hit([1, 3, 5, 7, 9, 11, 13, 15], 'hat', 0.28), 0.8, 0.9, 0.5);
const openHatStem = drumStem('openHat', hit([6, 14], 'openHat', 0.55), 0.62, 0.74, 0.5);
const kickStem = drumStem(
  'kick',
  [...hit([0, 4, 8, 12], 'kick', 0.95), ...hit([10], 'kick', 0.7)],
  0.5,
  0.62,
  0.85,
);
const snareStem = drumStem(
  'snare',
  [...hit([4, 12], 'snare', 0.95), ...hit([15], 'snare', 0.38)],
  0.56,
  0.68,
  0.75,
);
const clapStem = drumStem('clap', hit([4, 12], 'clap', 0.7), 0.76, 0.88, 0.55);
const fillStem = drumStem('fill', hit([12, 13, 14, 15], 'tom', 0.8), 0.62, 0.76, 0.7, [3, 7]);
const crashStem = drumStem('crash', hit([0], 'crash', 0.7), 0.6, 0.72, 0.6, [0, 4]);

/** Rescue: a hopeful bell line, whatever the fight is doing. */
const rescueBells: Stem = {
  id: 'rescueBells',
  instrument: 'bell',
  volume: 0.7,
  gate: { input: 'rescue', on: 0, full: 0.08 },
  octave: 2,
  reverb: 0.8,
  pattern: { kind: 'chord', hits: arp([0, 2, 1, 3, 2, 4, 3, 2], 2, 3, 0.6) },
};

/** Danger: a heartbeat and a dissonant pedal (a flat 2nd over the root) as the hull falls. */
const heartbeat: Stem = {
  id: 'heartbeat',
  instrument: 'kit',
  volume: 0.8,
  gate: { input: 'danger', on: 0.35, full: 0.7 },
  pattern: {
    kind: 'drums',
    hits: [
      [0, 'heart', 1],
      [3, 'heart', 0.7],
      [8, 'heart', 1],
      [11, 'heart', 0.7],
    ],
  },
};
const dreadPedal: Stem = {
  id: 'dread',
  instrument: 'strings',
  volume: 0.5,
  gate: { input: 'danger', on: 0.45, full: 0.8 },
  reverb: 0.6,
  pattern: {
    kind: 'line',
    hits: [
      [0, 13, 32, 0.6],
      [32, 13, 32, 0.6],
      [64, 13, 32, 0.6],
      [96, 12, 32, 0.6],
    ],
  },
};

// Cues ------------------------------------------------------------------------------------------

/** Flying: calm patrol -> rising threat -> full battle, one 8-bar loop over Am F C G | Am F Dm E. */
const battle: Cue = {
  bars: 8,
  chords: [Am7, Fmaj7, Cmaj7, Gadd9, Am7, Fmaj7, Dm7, E7],
  stems: [
    padStem,
    bassCalm,
    horn1,
    arpCalm,
    hatsStem,
    openHatStem,
    kickStem,
    bassDrive,
    snareStem,
    fillStem,
    crashStem,
    arpFast,
    brassStabs,
    clapStem,
    heroLead,
    hats16Stem,
    heroHigh,
    rescueBells,
    heartbeat,
    dreadPedal,
  ],
};

/** The Start screen: the patrol mood, a little brighter, with the lone horn and bells. */
const menu: Cue = {
  bars: 4,
  chords: [Am7, Fmaj7, Cmaj7, E7],
  intensity: 0.2,
  stems: [
    padStem,
    bassCalm,
    {
      ...horn1,
      pattern: {
        kind: 'motif',
        statements: [
          { motif: 'lone', bar: 0 },
          { motif: 'lone', bar: 2, transpose: 3 },
        ],
      },
    },
    { ...arpCalm, gate: { input: 'intensity', on: 0.1, full: 0.2 } },
    {
      id: 'menuBells',
      instrument: 'bell',
      volume: 0.5,
      gate: { input: 'intensity', on: 0.05, full: 0.15 },
      octave: 2,
      reverb: 0.85,
      pattern: {
        kind: 'chord',
        hits: [
          [0, 2, 4, 0.6],
          [6, 3, 4, 0.5],
          [10, 1, 5, 0.5],
        ],
        bars: [0, 1, 2, 3],
      },
    },
  ],
};

/** The debrief: warm and resolved (F C | Dm Am), hopeful lead over a slow bell arpeggio. */
const debrief: Cue = {
  bars: 4,
  chords: [Fmaj7, Gadd9, Cmaj7, Am7],
  intensity: 0.2,
  leave: 'phrase',
  stems: [
    { ...padStem, volume: 0.7 },
    bassCalm,
    {
      id: 'hopeLine',
      instrument: 'horn',
      volume: 0.7,
      gate: { input: 'intensity', on: 0.05, full: 0.15 },
      octave: 1,
      reverb: 0.7,
      pattern: { kind: 'motif', statements: [{ motif: 'hope', bar: 0 }] },
    },
    {
      id: 'debriefBells',
      instrument: 'bell',
      volume: 0.5,
      gate: { input: 'intensity', on: 0.05, full: 0.15 },
      octave: 2,
      reverb: 0.85,
      pattern: { kind: 'chord', hits: arp([0, 1, 2, 3], 4, 4, 0.55) },
    },
  ],
};

/** The end screen: sparse and solemn (Am F | Dm E), the stinger said the rest. */
const end: Cue = {
  bars: 4,
  chords: [Am7, Fmaj7, Dm7, E7],
  intensity: 0.15,
  stems: [
    { ...padStem, volume: 0.7 },
    {
      id: 'endBass',
      instrument: 'subBass',
      volume: 0.6,
      gate: { input: 'intensity', on: 0.05, full: 0.12 },
      octave: -1,
      pattern: { kind: 'chord', hits: [[0, 0, 15, 0.8]] },
    },
    {
      id: 'endBells',
      instrument: 'bell',
      volume: 0.5,
      gate: { input: 'intensity', on: 0.05, full: 0.12 },
      octave: 2,
      reverb: 0.9,
      pattern: {
        kind: 'chord',
        hits: [
          [0, 2, 6, 0.5],
          [8, 1, 8, 0.45],
        ],
        bars: [0, 2],
      },
    },
  ],
};

// Stingers --------------------------------------------------------------------------------------

/** A chord as simultaneous hits (pitches above A2). */
const chordHits = (step: number, pitches: readonly number[], length: number, vel = 0.9): Hit[] =>
  pitches.map((p) => [step, p, length, vel] as Hit);

const stingers: Record<string, Stinger> = {
  // Battle start: brass fanfare Am - Am - C - G, then the big held Am, with timpani and a crash.
  battleStart: {
    quantize: 'beat',
    steps: 32,
    priority: 6,
    volume: 0.9,
    duck: { amount: 0.55 },
    parts: [
      {
        instrument: 'brass',
        hits: [
          ...chordHits(0, [12, 15, 19, 24], 3),
          ...chordHits(4, [12, 15, 19, 24], 2, 0.8),
          ...chordHits(8, [15, 19, 22, 27], 3),
          ...chordHits(12, [10, 14, 17, 22], 3),
          ...chordHits(16, [12, 19, 24, 27, 31], 14, 1),
        ],
      },
      { instrument: 'strings', hits: chordHits(0, [12, 19, 24], 32, 0.55) },
      {
        instrument: 'kit',
        drums: [
          [0, 'riser', 0.6],
          [0, 'timp', 0.9],
          [8, 'timp', 0.8],
          [12, 'timp', 0.9],
          [14, 'tom', 0.8],
          [15, 'tom', 0.95],
          [16, 'timp', 1],
          [16, 'crash', 0.9],
          [16, 'boom', 1],
        ],
      },
    ],
  },
  // A new wave: two low horn notes a half step apart and siren pings.
  waveStart: {
    quantize: 'beat',
    steps: 16,
    priority: 3,
    volume: 0.8,
    duck: { amount: 0.35 },
    parts: [
      {
        instrument: 'brass',
        hits: [
          [0, 7, 7, 0.9],
          [8, 8, 8, 1],
        ],
      },
      {
        instrument: 'alarm',
        hits: [
          [0, 36, 2, 0.7],
          [4, 36, 2, 0.7],
          [8, 36, 2, 0.7],
        ],
      },
      {
        instrument: 'kit',
        drums: [
          [0, 'timp', 0.9],
          [8, 'timp', 1],
        ],
      },
    ],
  },
  // The first fighters show up: tremolo strings that build, a wash, one low hit.
  threat: {
    quantize: 'beat',
    steps: 16,
    priority: 2,
    volume: 0.75,
    parts: [
      {
        instrument: 'strings',
        hits: Array.from({ length: 14 }, (_, i): Hit => [i, i < 8 ? 12 : 13, 1, 0.2 + i * 0.045]),
      },
      {
        instrument: 'kit',
        drums: [
          [0, 'riser', 0.5],
          [14, 'timp', 0.9],
        ],
      },
    ],
  },
  // Battle won: a rising fanfare in C, a lead line on top.
  victory: {
    quantize: 'beat',
    steps: 32,
    priority: 5,
    volume: 0.85,
    duck: { amount: 0.5 },
    parts: [
      {
        instrument: 'brass',
        hits: [
          ...chordHits(0, [8, 12, 15, 20], 3),
          ...chordHits(4, [10, 14, 17, 22], 3),
          ...chordHits(8, [15, 19, 22, 27], 10, 1),
        ],
      },
      {
        instrument: 'lead',
        hits: [
          [0, 24, 3, 0.9],
          [4, 27, 3],
          [8, 31, 6, 1],
          [16, 34, 4, 0.95],
          [20, 31, 2],
          [22, 34, 2],
          [24, 36, 8, 1],
        ],
      },
      { instrument: 'strings', hits: chordHits(0, [15, 19, 22], 28, 0.5) },
      {
        instrument: 'kit',
        drums: [
          [0, 'timp', 0.9],
          [4, 'timp', 0.8],
          [8, 'timp', 1],
          [8, 'crash', 0.8],
        ],
      },
      {
        instrument: 'bell',
        hits: [
          [16, 43, 8, 0.5],
          [20, 46, 10, 0.45],
        ],
      },
    ],
  },
  // The run is won: the same fanfare, bigger, and a turn to A major (the major third) at the end.
  finale: {
    quantize: 'beat',
    steps: 64,
    priority: 8,
    volume: 1,
    duck: { amount: 0.7 },
    muteCue: true,
    parts: [
      {
        instrument: 'brass',
        hits: [
          ...chordHits(0, [8, 12, 15, 20], 6),
          ...chordHits(8, [10, 14, 17, 22], 6),
          ...chordHits(16, [12, 19, 24, 27], 14, 1),
          ...chordHits(32, [12, 16, 19, 24, 28], 30, 1),
        ],
      },
      {
        instrument: 'lead',
        hits: [
          [0, 24, 6, 0.95],
          [8, 26, 6],
          [16, 27, 10, 1],
          [28, 31, 4],
          [32, 36, 24, 1],
        ],
      },
      { instrument: 'strings', hits: chordHits(0, [12, 19, 24], 64, 0.6) },
      {
        instrument: 'kit',
        drums: [
          [0, 'timp', 1],
          [8, 'timp', 0.9],
          [16, 'timp', 1],
          [16, 'crash', 0.8],
          [28, 'tom', 0.8],
          [30, 'tom', 0.9],
          [32, 'timp', 1],
          [32, 'crash', 1],
          [32, 'boom', 0.9],
        ],
      },
      {
        instrument: 'bell',
        hits: [
          [32, 48, 16, 0.5],
          [36, 52, 20, 0.45],
          [40, 55, 24, 0.4],
        ],
      },
    ],
  },
  // The run is lost: a slow minor descent in the horn over low strings, and one huge hit.
  defeat: {
    quantize: 'beat',
    steps: 48,
    priority: 9,
    volume: 0.95,
    duck: { amount: 0.9 },
    muteCue: true,
    parts: [
      {
        instrument: 'horn',
        hits: [
          [0, 19, 12, 0.9],
          [12, 17, 12, 0.85],
          [24, 15, 12, 0.8],
          [36, 12, 12, 0.9],
        ],
      },
      {
        instrument: 'strings',
        hits: [...chordHits(0, [0, 7, 12], 24, 0.6), ...chordHits(24, [-4, 3, 8], 24, 0.6)],
      },
      {
        instrument: 'kit',
        drums: [
          [0, 'timp', 0.9],
          [12, 'timp', 0.7],
          [24, 'timp', 0.6],
          [36, 'boom', 1],
        ],
      },
    ],
  },
  // A pilot is lost: the cue drops out, a solo falls E - C - A over a heartbeat.
  pilotLost: {
    quantize: 'beat',
    steps: 24,
    priority: 4,
    volume: 0.85,
    duck: { amount: 0.8 },
    muteCue: true,
    parts: [
      {
        instrument: 'horn',
        hits: [
          [0, 31, 6, 0.9],
          [6, 27, 6, 0.85],
          [12, 24, 12, 0.8],
        ],
      },
      { instrument: 'strings', hits: chordHits(0, [12, 19, 24], 24, 0.45) },
      {
        instrument: 'kit',
        drums: [
          [0, 'heart', 1],
          [3, 'heart', 0.7],
          [8, 'heart', 0.9],
          [11, 'heart', 0.6],
        ],
      },
    ],
  },
  // Rescue complete: an upward bell run in C.
  rescued: {
    quantize: 'beat',
    steps: 16,
    priority: 3,
    volume: 0.8,
    duck: { amount: 0.3 },
    parts: [
      {
        instrument: 'bell',
        hits: [
          [0, 27, 3, 0.8],
          [2, 31, 3, 0.8],
          [4, 34, 3, 0.8],
          [6, 39, 8, 0.9],
          [10, 46, 8, 0.5],
        ],
      },
      { instrument: 'strings', hits: chordHits(0, [15, 19, 22], 14, 0.4) },
    ],
  },
  // A distress beacon: two soft pings.
  beacon: {
    quantize: 'beat',
    steps: 8,
    priority: 1,
    volume: 0.8,
    parts: [
      {
        instrument: 'bell',
        hits: [
          [0, 36, 4, 0.7],
          [3, 43, 5, 0.6],
        ],
      },
    ],
  },
  // A wingman is down: a low half-step clash and a timpani hit.
  wingmanDown: {
    quantize: 'beat',
    steps: 16,
    priority: 3,
    volume: 0.8,
    duck: { amount: 0.35 },
    parts: [
      {
        instrument: 'brass',
        hits: [
          [0, 7, 8, 0.8],
          [0, 8, 8, 0.8],
        ],
      },
      { instrument: 'kit', drums: [[0, 'timp', 0.9]] },
    ],
  },
  // A pilot joins: two bright bells.
  welcome: {
    quantize: 'beat',
    steps: 8,
    priority: 2,
    volume: 0.8,
    parts: [
      {
        instrument: 'bell',
        hits: [
          [0, 31, 3, 0.7],
          [2, 36, 5, 0.7],
        ],
      },
    ],
  },
};

export const score: ScoreDef = {
  bpm: 124,
  key: 110,
  fade: 0.9,
  stingerLevel: 1.9,
  instruments,
  motifs,
  cues: { battle, menu, debrief, end },
  stingers,
  scenes: { menu: 'menu', flight: 'battle', debrief: 'debrief', end: 'end' },
  triggers: [
    { on: 'BattleStarted', stinger: 'battleStart' },
    { on: 'WaveStarted', minWave: 2, stinger: 'waveStart' },
    { on: 'threat', stinger: 'threat' },
    { on: 'BattleCleared', stinger: 'victory' },
    { on: 'RunEnded', result: 'victory', stinger: 'finale' },
    { on: 'RunEnded', result: 'defeat', stinger: 'defeat' },
    { on: 'PilotLost', stinger: 'pilotLost' },
    { on: 'PodRescued', stinger: 'rescued' },
    { on: 'PodSpawned', stinger: 'beacon' },
    { on: 'WingmanDown', stinger: 'wingmanDown' },
    { on: 'PilotJoined', stinger: 'welcome' },
  ],
  intensity: {
    calm: 0.12,
    enemiesFull: 8,
    enemyFloor: 0.28,
    enemyWeight: 0.42,
    dangerFrom: 0.6,
    dangerWeight: 0.3,
    heatPerHit: 0.12,
    heatPerKill: 0.05,
    heatWeight: 0.25,
    heatDecay: 0.12,
    rise: 2.5,
    fall: 9,
  },
};

/** The music slot: the adaptive score. `volume` is the level of the whole score before the Music volume in the mix. */
export const music: MusicDef = { volume: 0.3, source: { kind: 'score', score } };
