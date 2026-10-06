import type { SynthLayer } from '../render/style';

/**
 * The score: a composed, layered, state-driven piece of music as plain data. Pure types, pure
 * helpers and the validation; the state machine that follows the game is `conductor.ts`, the sound
 * making is `webaudio.ts`. Time is bars of 4 beats; a step is a sixteenth note (16 steps a bar).
 *
 * Shape: a `key` (the tonic in Hz; every pitch is whole semitones above it), `instruments`
 * (synth voices or drum kits), `motifs` (short reusable melodic cells), `cues` (loops of bars over a
 * chord progression, each a set of `stems` that fade in and out with a game value), `stingers`
 * (short one-shot phrases) and the rules that connect the game to them (`scenes`, `triggers`,
 * `intensity`).
 */

export const STEPS_PER_BAR = 16;
export const BEATS_PER_BAR = 4;
export const STEPS_PER_BEAT = STEPS_PER_BAR / BEATS_PER_BAR;

export const SCENES = ['menu', 'flight', 'debrief', 'end'] as const;
/** Where the game is: the Start screen, flying (practice or a battle), the debrief, the end screen. */
export type Scene = (typeof SCENES)[number];

/** Values a stem's gate can follow (all 0..1): the smoothed `intensity`, pod `rescue` progress, hull `danger` (1 - hull). */
export const GATE_INPUTS = ['intensity', 'rescue', 'danger'] as const;
export type GateInput = (typeof GATE_INPUTS)[number];

/** A note: [step, pitch, length in steps, velocity 0..1 (default 0.8)]. Pitch is a chord degree or whole semitones, see the pattern kinds. */
export type Hit = readonly [step: number, pitch: number, length: number, velocity?: number];
/** A drum hit: [step, piece name in the kit, velocity 0..1 (default 0.8)]. */
export type DrumHit = readonly [step: number, piece: string, velocity?: number];

export interface Voice {
  waveform: 'sine' | 'square' | 'sawtooth' | 'triangle';
  /** Cents. Several voices a few cents apart sound thick. */
  detune?: number;
  /** 0..1 within the note. */
  gain: number;
  /** Octaves above (or below, negative) the played note; fractions give inharmonic partials (bells). */
  octave?: number;
}

/** A pitched synth: voices, an ADSR envelope, an optional resonant filter that sweeps, grit and vibrato. */
export interface PitchedInstrument {
  kind: 'pitched';
  voices: readonly Voice[];
  /** Seconds (s). */
  attack: number;
  decay: number;
  /** Level held after the decay, 0..1 of the peak. */
  sustain: number;
  /** Seconds the note takes to die away after its length (s). */
  release: number;
  filter?: {
    type: 'lowpass' | 'highpass' | 'bandpass';
    /** Cutoff at the start of the note, Hz. */
    freq: number;
    /** Cutoff after the decay, Hz (the filter sweeps there); omit for a fixed cutoff. */
    freqEnd?: number;
    q: number;
    /** 0..1: how much the cutoff follows the note's pitch (relative to 261.6 Hz). */
    track?: number;
  };
  /** 0..1 waveshaper drive. */
  distortion?: number;
  vibrato?: {
    rate: number;
    /** cents */ depth: number;
    /** seconds before it starts */ delay?: number;
  };
  /** Loudness of the instrument, 0..1. */
  gain: number;
}

/** Drum pieces: each a short synthesised sound (layers as in a sound effect). */
export interface DrumKit {
  kind: 'kit';
  pieces: Readonly<Record<string, { layers: readonly SynthLayer[]; gain: number }>>;
}

export type Instrument = PitchedInstrument | DrumKit;

/** One statement of a motif: where it starts (bar of the cue), shifted by semitones and octaves. */
export interface MotifStatement {
  motif: string;
  bar: number;
  transpose?: number;
  octave?: number;
}

export type StemPattern =
  /** Repeats every bar (or only in `bars`); pitch is a chord degree (0 = root, 1 = next chord tone, wraps up an octave, may be negative). */
  | { kind: 'chord'; hits: readonly Hit[]; bars?: readonly number[] }
  /** Notes over the whole cue (steps 0 .. bars*16-1); pitch is semitones above the key. */
  | { kind: 'line'; hits: readonly Hit[] }
  /** A melody built from motifs (the same cells stated again, answered and transposed). */
  | { kind: 'motif'; statements: readonly MotifStatement[] }
  /** Drum hits that repeat every bar (or only in `bars`). */
  | { kind: 'drums'; hits: readonly DrumHit[]; bars?: readonly number[] }
  /** A looping audio file of `bars` bars at the score's tempo (the sample option). */
  | { kind: 'sample'; file: string; bars: number };

export interface Stem {
  id: string;
  /** Key in `score.instruments` (a pitched one for chord/line/motif patterns, a kit for drums). Unused by samples. */
  instrument: string;
  /** Level trim 0..1 (the panel edits it live). */
  volume: number;
  /** Fades in as the value rises from `on` to `full`, and (optional) back out from `out` to `outFull`. */
  gate: { input: GateInput; on: number; full: number; out?: number; outFull?: number };
  /** Octaves added to the pitches. */
  octave?: number;
  /** Reverb send 0..1 (the score's own hall). */
  reverb?: number;
  pattern: StemPattern;
}

export interface Chord {
  /** Semitones above the key. */
  root: number;
  /** Chord tones in semitones above the root (3 or 4 of them). */
  tones: readonly number[];
}

export interface Cue {
  /** Bars in one pass of the loop. */
  bars: number;
  /** One chord per bar. */
  chords: readonly Chord[];
  stems: readonly Stem[];
  /** `bar`: a different scene takes over at the next bar line; `phrase`: only when this cue wraps. Default `bar`. */
  leave?: 'bar' | 'phrase';
  /** Fixed intensity for scenes that do not follow the fight (menu, debrief, end), 0..1. */
  intensity?: number;
}

export interface StingerPart {
  instrument: string;
  /** Pitched: pitch is semitones above the key. Kit: use `drums`. */
  hits?: readonly Hit[];
  drums?: readonly DrumHit[];
  octave?: number;
}

export interface Stinger {
  /** Starts now, on the next beat line or on the next bar line. */
  quantize: 'now' | 'beat' | 'bar';
  /** Length in steps (it blocks lower-priority stingers and mutes/ducks the cue for this long). */
  steps: number;
  parts: readonly StingerPart[];
  /** A higher priority replaces or blocks a lower one. */
  priority: number;
  /** Loudness 0..1. */
  volume: number;
  /** Dips the cue while it plays. */
  duck?: { amount: number };
  /** Cuts the cue's notes for the length of the stinger (a dramatic silence). */
  muteCue?: boolean;
}

/** What makes a stinger play: a game event (optionally filtered), or `threat` (the first enemies of a fight appear). */
export interface Trigger {
  on:
    | 'BattleStarted'
    | 'WaveStarted'
    | 'BattleCleared'
    | 'RunEnded'
    | 'PilotLost'
    | 'PodSpawned'
    | 'PodRescued'
    | 'WingmanDown'
    | 'PilotJoined'
    | 'threat';
  /** `RunEnded` only. */
  result?: 'victory' | 'defeat';
  /** `WaveStarted` only: not before this wave (wave 1 comes with the battle start). */
  minWave?: number;
  stinger: string;
}

export interface IntensityRules {
  /** Intensity while flying with nothing to fight. */
  calm: number;
  /** Enemies (fighters and turrets) that count as a full fight. */
  enemiesFull: number;
  /** Added as soon as any enemy is alive. */
  enemyFloor: number;
  /** Added in proportion to the enemies alive (0 .. enemiesFull). */
  enemyWeight: number;
  /** Hull share (0..1) below which danger starts. */
  dangerFrom: number;
  /** Added at hull 0 (in proportion below `dangerFrom`). */
  dangerWeight: number;
  /** Recent action (hits taken, kills) that decays: added per hit/kill, its weight, decay per second. */
  heatPerHit: number;
  heatPerKill: number;
  heatWeight: number;
  heatDecay: number;
  /** Seconds the intensity takes to rise to a higher target and to fall to a lower one (s). */
  rise: number;
  fall: number;
}

export interface ScoreDef {
  /** Beats per minute (a bar is 4 beats). */
  bpm: number;
  /** The tonic: every pitch is whole semitones above this, Hz. */
  key: number;
  instruments: Readonly<Record<string, Instrument>>;
  motifs: Readonly<Record<string, readonly Hit[]>>;
  cues: Readonly<Record<string, Cue>>;
  stingers: Readonly<Record<string, Stinger>>;
  /** Which cue each scene plays. */
  scenes: Readonly<Record<Scene, string>>;
  triggers: readonly Trigger[];
  intensity: IntensityRules;
  /** Seconds a stem takes to fade to a new level (it moves at bar lines). */
  fade: number;
  /** Loudness of the stingers relative to the score's level (1 = as loud as the score): stingers are the punctuation. */
  stingerLevel: number;
}

// Planning (pure) -------------------------------------------------------------------------

export function semitones(key: number, n: number): number {
  return key * 2 ** (n / 12);
}

/** A chord degree as semitones above the key: degree 0 is the root, 1.. the chord tones, wrapping up an octave. */
export function degreePitch(chord: Chord, degree: number): number {
  const n = chord.tones.length;
  const octave = Math.floor(degree / n);
  const tone = chord.tones[((degree % n) + n) % n]!;
  return chord.root + tone + 12 * octave;
}

/** Seconds of one sixteenth note. */
export function stepSeconds(bpm: number): number {
  return 60 / bpm / STEPS_PER_BEAT;
}

export function barSeconds(bpm: number): number {
  return stepSeconds(bpm) * STEPS_PER_BAR;
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const smooth = (t: number): number => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

/** How loud a stem is for a gate value: 0 below `on`, 1 from `full`, (optionally) back to 0 from `out` to `outFull`. */
export function gateGain(gate: Stem['gate'], value: number): number {
  const rise = smooth((value - gate.on) / Math.max(1e-6, gate.full - gate.on));
  if (gate.out === undefined) return rise;
  const fall =
    1 - smooth((value - gate.out) / Math.max(1e-6, (gate.outFull ?? gate.out + 0.1) - gate.out));
  return rise * fall;
}

/** Below this a stem counts as off (its notes are not scheduled). */
export const STEM_OFF = 0.01;

export interface PitchedNote {
  kind: 'pitched';
  /** Seconds after the start of the plan (s). */
  at: number;
  /** Seconds (s). */
  length: number;
  vel: number;
  freq: number;
  instrument: PitchedInstrument;
  stem: string;
}

export interface DrumNote {
  kind: 'drum';
  at: number;
  vel: number;
  layers: readonly SynthLayer[];
  gain: number;
  stem: string;
}

export type ScoreNote = PitchedNote | DrumNote;

const DEFAULT_VEL = 0.8;

export function motifHits(
  score: ScoreDef,
  statements: readonly MotifStatement[],
): { step: number; pitch: number; length: number; vel: number }[] {
  const out: { step: number; pitch: number; length: number; vel: number }[] = [];
  for (const s of statements) {
    const cell = score.motifs[s.motif];
    if (!cell) continue;
    for (const [step, pitch, length, vel] of cell) {
      out.push({
        step: step + s.bar * STEPS_PER_BAR,
        pitch: pitch + (s.transpose ?? 0) + 12 * (s.octave ?? 0),
        length,
        vel: vel ?? DEFAULT_VEL,
      });
    }
  }
  return out;
}

/** The notes of one stem in one bar of its cue (times in seconds from the start of the bar). Pure. */
export function stemNotes(score: ScoreDef, cue: Cue, stem: Stem, bar: number): ScoreNote[] {
  const step = stepSeconds(score.bpm);
  const instrument = score.instruments[stem.instrument];
  const notes: ScoreNote[] = [];
  const pitched = (
    hits: readonly { step: number; pitch: number; length: number; vel: number }[],
    toSemis: (pitch: number) => number,
  ): void => {
    if (!instrument || instrument.kind !== 'pitched') return;
    for (const h of hits) {
      notes.push({
        kind: 'pitched',
        at: h.step * step,
        length: Math.max(step * 0.5, h.length * step * 0.97),
        vel: h.vel,
        freq: semitones(score.key, toSemis(h.pitch) + 12 * (stem.octave ?? 0)),
        instrument,
        stem: stem.id,
      });
    }
  };
  const p = stem.pattern;
  switch (p.kind) {
    case 'chord': {
      if (p.bars && !p.bars.includes(bar)) break;
      const chord = cue.chords[bar % cue.chords.length]!;
      pitched(
        p.hits.map(([s, pitch, length, vel]) => ({
          step: s,
          pitch,
          length,
          vel: vel ?? DEFAULT_VEL,
        })),
        (d) => degreePitch(chord, d),
      );
      break;
    }
    case 'line':
    case 'motif': {
      const all =
        p.kind === 'line'
          ? p.hits.map(([s, pitch, length, vel]) => ({
              step: s,
              pitch,
              length,
              vel: vel ?? DEFAULT_VEL,
            }))
          : motifHits(score, p.statements);
      const from = bar * STEPS_PER_BAR;
      pitched(
        all
          .filter((h) => h.step >= from && h.step < from + STEPS_PER_BAR)
          .map((h) => ({ ...h, step: h.step - from })),
        (semis) => semis,
      );
      break;
    }
    case 'drums': {
      if (p.bars && !p.bars.includes(bar)) break;
      if (!instrument || instrument.kind !== 'kit') break;
      for (const [s, piece, vel] of p.hits) {
        const def = instrument.pieces[piece];
        if (!def) continue;
        notes.push({
          kind: 'drum',
          at: s * step,
          vel: vel ?? DEFAULT_VEL,
          layers: def.layers,
          gain: def.gain,
          stem: stem.id,
        });
      }
      break;
    }
    case 'sample':
      break;
  }
  return notes;
}

/** The notes of a stinger (times from its start). */
export function stingerNotes(score: ScoreDef, sting: Stinger): ScoreNote[] {
  const step = stepSeconds(score.bpm);
  const notes: ScoreNote[] = [];
  for (const part of sting.parts) {
    const instrument = score.instruments[part.instrument];
    if (!instrument) continue;
    if (instrument.kind === 'pitched') {
      for (const [s, pitch, length, vel] of part.hits ?? []) {
        notes.push({
          kind: 'pitched',
          at: s * step,
          length: Math.max(step * 0.5, length * step * 0.97),
          vel: (vel ?? DEFAULT_VEL) * sting.volume,
          freq: semitones(score.key, pitch + 12 * (part.octave ?? 0)),
          instrument,
          stem: '_sting',
        });
      }
    } else {
      for (const [s, piece, vel] of part.drums ?? []) {
        const def = instrument.pieces[piece];
        if (!def) continue;
        notes.push({
          kind: 'drum',
          at: s * step,
          vel: (vel ?? DEFAULT_VEL) * sting.volume,
          layers: def.layers,
          gain: def.gain,
          stem: '_sting',
        });
      }
    }
  }
  return notes.sort((a, b) => a.at - b.at);
}

// Validation ------------------------------------------------------------------------------

const isNum = (v: unknown, min: number, max: number): boolean =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const isInt = (v: unknown, min: number, max: number): boolean =>
  isNum(v, min, max) && Number.isInteger(v);
const VOICE_WAVES = ['sine', 'square', 'sawtooth', 'triangle'];

export const MAX_STEMS_PER_CUE = 20;
export const MAX_BARS = 16;
export const MAX_STINGER_STEPS = 128;

function validateHits(
  where: string,
  hits: readonly Hit[] | undefined,
  stepLimit: number,
  pitchRange: [number, number],
): string[] {
  if (!Array.isArray(hits) || hits.length < 1 || hits.length > 256)
    return [`${where} must have 1..256 notes`];
  const errors: string[] = [];
  hits.forEach((h, i) => {
    if (!Array.isArray(h) || h.length < 3 || h.length > 4)
      return void errors.push(`${where}[${i}] must be [step, pitch, length, velocity?]`);
    if (!isInt(h[0], 0, stepLimit - 1))
      errors.push(`${where}[${i}] step must be a whole number 0..${stepLimit - 1}`);
    if (!isInt(h[1], pitchRange[0], pitchRange[1]))
      errors.push(`${where}[${i}] pitch must be a whole number ${pitchRange[0]}..${pitchRange[1]}`);
    if (!isInt(h[2], 1, 64)) errors.push(`${where}[${i}] length must be 1..64 steps`);
    if (h[3] !== undefined && !isNum(h[3], 0, 1))
      errors.push(`${where}[${i}] velocity must be 0..1`);
  });
  return errors;
}

function validateDrums(
  where: string,
  hits: readonly DrumHit[] | undefined,
  stepLimit: number,
  kit: DrumKit | undefined,
): string[] {
  if (!Array.isArray(hits) || hits.length < 1 || hits.length > 256)
    return [`${where} must have 1..256 hits`];
  const errors: string[] = [];
  hits.forEach((h, i) => {
    if (!Array.isArray(h) || h.length < 2 || h.length > 3)
      return void errors.push(`${where}[${i}] must be [step, piece, velocity?]`);
    if (!isInt(h[0], 0, stepLimit - 1))
      errors.push(`${where}[${i}] step must be a whole number 0..${stepLimit - 1}`);
    if (kit && !kit.pieces[h[1]]) errors.push(`${where}[${i}] piece "${h[1]}" is not in the kit`);
    if (h[2] !== undefined && !isNum(h[2], 0, 1))
      errors.push(`${where}[${i}] velocity must be 0..1`);
  });
  return errors;
}

/** Structure checks for a score (the drum pieces' synth layers are checked by the style contract, which knows layers). */
export function validateScore(score: ScoreDef | undefined): string[] {
  const at = 'music.source.score';
  if (!score || typeof score !== 'object') return [`${at} must be a score`];
  const errors: string[] = [];
  if (!isNum(score.bpm, 60, 200)) errors.push(`${at}.bpm must be 60..200`);
  if (!isNum(score.key, 20, 1000)) errors.push(`${at}.key must be 20..1000 Hz`);
  if (!isNum(score.fade, 0.05, 10)) errors.push(`${at}.fade must be 0.05..10 s`);
  if (!isNum(score.stingerLevel, 0, 4)) errors.push(`${at}.stingerLevel must be 0..4`);
  const instruments = score.instruments ?? {};
  for (const [id, ins] of Object.entries(instruments)) {
    const w = `${at}.instruments.${id}`;
    if (ins.kind === 'pitched') {
      if (!Array.isArray(ins.voices) || ins.voices.length < 1 || ins.voices.length > 4)
        errors.push(`${w}.voices must be 1..4 voices`);
      else
        ins.voices.forEach((v, i) => {
          if (!VOICE_WAVES.includes(v.waveform))
            errors.push(`${w}.voices[${i}].waveform is unknown`);
          if (!isNum(v.gain, 0, 1)) errors.push(`${w}.voices[${i}].gain must be 0..1`);
          if (v.detune !== undefined && !isNum(v.detune, -1200, 1200))
            errors.push(`${w}.voices[${i}].detune must be -1200..1200 cents`);
          if (v.octave !== undefined && !isNum(v.octave, -4, 4))
            errors.push(`${w}.voices[${i}].octave must be -4..4`);
        });
      if (!isNum(ins.attack, 0.001, 5)) errors.push(`${w}.attack must be 0.001..5 s`);
      if (!isNum(ins.decay, 0.005, 5)) errors.push(`${w}.decay must be 0.005..5 s`);
      if (!isNum(ins.sustain, 0, 1)) errors.push(`${w}.sustain must be 0..1`);
      if (!isNum(ins.release, 0.005, 6)) errors.push(`${w}.release must be 0.005..6 s`);
      if (!isNum(ins.gain, 0, 1)) errors.push(`${w}.gain must be 0..1`);
      if (ins.distortion !== undefined && !isNum(ins.distortion, 0, 1))
        errors.push(`${w}.distortion must be 0..1`);
      if (ins.filter) {
        if (!['lowpass', 'highpass', 'bandpass'].includes(ins.filter.type))
          errors.push(`${w}.filter.type is unknown`);
        if (!isNum(ins.filter.freq, 20, 20000))
          errors.push(`${w}.filter.freq must be 20..20000 Hz`);
        if (ins.filter.freqEnd !== undefined && !isNum(ins.filter.freqEnd, 20, 20000))
          errors.push(`${w}.filter.freqEnd must be 20..20000 Hz`);
        if (!isNum(ins.filter.q, 0.1, 30)) errors.push(`${w}.filter.q must be 0.1..30`);
        if (ins.filter.track !== undefined && !isNum(ins.filter.track, 0, 1))
          errors.push(`${w}.filter.track must be 0..1`);
      }
      if (ins.vibrato) {
        if (!isNum(ins.vibrato.rate, 0.1, 20)) errors.push(`${w}.vibrato.rate must be 0.1..20 Hz`);
        if (!isNum(ins.vibrato.depth, 0, 200))
          errors.push(`${w}.vibrato.depth must be 0..200 cents`);
      }
    } else if (ins.kind === 'kit') {
      const names = Object.keys(ins.pieces ?? {});
      if (names.length < 1) errors.push(`${w}.pieces must not be empty`);
      for (const n of names) {
        const piece = ins.pieces[n]!;
        if (!isNum(piece.gain, 0, 1)) errors.push(`${w}.pieces.${n}.gain must be 0..1`);
        if (!Array.isArray(piece.layers) || piece.layers.length < 1 || piece.layers.length > 6)
          errors.push(`${w}.pieces.${n}.layers must be 1..6 layers`);
      }
    } else errors.push(`${w}.kind must be pitched or kit`);
  }
  for (const [id, cell] of Object.entries(score.motifs ?? {})) {
    errors.push(...validateHits(`${at}.motifs.${id}`, cell, MAX_BARS * STEPS_PER_BAR, [-36, 48]));
  }
  const cues = Object.entries(score.cues ?? {});
  if (cues.length < 1) errors.push(`${at}.cues must have at least one cue`);
  for (const [id, cue] of cues) {
    const w = `${at}.cues.${id}`;
    if (!isInt(cue.bars, 1, MAX_BARS)) {
      errors.push(`${w}.bars must be a whole number 1..${MAX_BARS}`);
      continue;
    }
    if (!Array.isArray(cue.chords) || cue.chords.length !== cue.bars)
      errors.push(`${w}.chords must have one chord per bar`);
    else
      cue.chords.forEach((c, i) => {
        if (!isInt(c.root, -36, 36))
          errors.push(`${w}.chords[${i}].root must be a whole number -36..36`);
        if (
          !Array.isArray(c.tones) ||
          c.tones.length < 3 ||
          c.tones.length > 5 ||
          !c.tones.every((t: number) => isInt(t, 0, 24))
        )
          errors.push(`${w}.chords[${i}].tones must be 3..5 whole semitones 0..24`);
      });
    if (cue.leave !== undefined && cue.leave !== 'bar' && cue.leave !== 'phrase')
      errors.push(`${w}.leave must be bar or phrase`);
    if (cue.intensity !== undefined && !isNum(cue.intensity, 0, 1))
      errors.push(`${w}.intensity must be 0..1`);
    if (!Array.isArray(cue.stems) || cue.stems.length < 1 || cue.stems.length > MAX_STEMS_PER_CUE) {
      errors.push(`${w}.stems must be 1..${MAX_STEMS_PER_CUE} stems`);
      continue;
    }
    const ids = new Set<string>();
    for (const stem of cue.stems) {
      const s = `${w}.stems.${stem.id}`;
      if (!stem.id || ids.has(stem.id)) errors.push(`${s}: ids must be unique and not empty`);
      ids.add(stem.id);
      if (!isNum(stem.volume, 0, 1)) errors.push(`${s}.volume must be 0..1`);
      if (!GATE_INPUTS.includes(stem.gate?.input)) errors.push(`${s}.gate.input is unknown`);
      else if (
        !isNum(stem.gate.on, -1, 1.01) ||
        !isNum(stem.gate.full, -1, 1.01) ||
        stem.gate.full < stem.gate.on
      )
        errors.push(`${s}.gate on/full must be 0..1 with full >= on`);
      if (stem.octave !== undefined && !isInt(stem.octave, -4, 4))
        errors.push(`${s}.octave must be a whole number -4..4`);
      if (stem.reverb !== undefined && !isNum(stem.reverb, 0, 1))
        errors.push(`${s}.reverb must be 0..1`);
      const p = stem.pattern;
      const ins = instruments[stem.instrument];
      const needs = (kind: 'pitched' | 'kit'): void => {
        if (!ins) errors.push(`${s}.instrument "${stem.instrument}" does not exist`);
        else if (ins.kind !== kind)
          errors.push(
            `${s}.instrument "${stem.instrument}" must be a ${kind} instrument for a ${p.kind} pattern`,
          );
      };
      const barsOk = (bars: readonly number[] | undefined): void => {
        if (bars && !bars.every((b) => isInt(b, 0, cue.bars - 1)))
          errors.push(`${s}.pattern.bars must be bar numbers 0..${cue.bars - 1}`);
      };
      switch (p?.kind) {
        case 'chord':
          needs('pitched');
          barsOk(p.bars);
          errors.push(...validateHits(`${s}.pattern.hits`, p.hits, STEPS_PER_BAR, [-12, 24]));
          break;
        case 'line':
          needs('pitched');
          errors.push(
            ...validateHits(`${s}.pattern.hits`, p.hits, cue.bars * STEPS_PER_BAR, [-36, 48]),
          );
          break;
        case 'motif':
          needs('pitched');
          if (!Array.isArray(p.statements) || p.statements.length < 1)
            errors.push(`${s}.pattern.statements must not be empty`);
          else
            p.statements.forEach((m: MotifStatement, i: number) => {
              if (!score.motifs?.[m.motif])
                errors.push(`${s}.pattern.statements[${i}] motif "${m.motif}" does not exist`);
              if (!isInt(m.bar, 0, cue.bars - 1))
                errors.push(`${s}.pattern.statements[${i}].bar must be 0..${cue.bars - 1}`);
              if (m.transpose !== undefined && !isInt(m.transpose, -24, 24))
                errors.push(
                  `${s}.pattern.statements[${i}].transpose must be whole semitones -24..24`,
                );
              const cell = score.motifs?.[m.motif];
              if (
                cell &&
                Math.max(...cell.map((h) => h[0])) + m.bar * STEPS_PER_BAR >=
                  cue.bars * STEPS_PER_BAR
              )
                errors.push(`${s}.pattern.statements[${i}] runs past the end of the cue`);
            });
          break;
        case 'drums':
          needs('kit');
          barsOk(p.bars);
          errors.push(
            ...validateDrums(
              `${s}.pattern.hits`,
              p.hits,
              STEPS_PER_BAR,
              ins?.kind === 'kit' ? ins : undefined,
            ),
          );
          break;
        case 'sample':
          if (typeof p.file !== 'string' || !p.file.trim())
            errors.push(`${s}.pattern.file is empty`);
          if (!isInt(p.bars, 1, MAX_BARS)) errors.push(`${s}.pattern.bars must be 1..${MAX_BARS}`);
          break;
        default:
          errors.push(`${s}.pattern.kind is unknown`);
      }
    }
  }
  const stingers = score.stingers ?? {};
  for (const [id, st] of Object.entries(stingers)) {
    const w = `${at}.stingers.${id}`;
    if (!['now', 'beat', 'bar'].includes(st.quantize))
      errors.push(`${w}.quantize must be now, beat or bar`);
    if (!isInt(st.steps, 1, MAX_STINGER_STEPS))
      errors.push(`${w}.steps must be 1..${MAX_STINGER_STEPS}`);
    if (!isInt(st.priority, 0, 10)) errors.push(`${w}.priority must be 0..10`);
    if (!isNum(st.volume, 0, 1)) errors.push(`${w}.volume must be 0..1`);
    if (st.duck && !isNum(st.duck.amount, 0, 1)) errors.push(`${w}.duck.amount must be 0..1`);
    if (!Array.isArray(st.parts) || st.parts.length < 1 || st.parts.length > 12) {
      errors.push(`${w}.parts must be 1..12 parts`);
      continue;
    }
    st.parts.forEach((part, i) => {
      const pw = `${w}.parts[${i}]`;
      const ins = instruments[part.instrument];
      if (!ins) return void errors.push(`${pw}.instrument "${part.instrument}" does not exist`);
      if (ins.kind === 'pitched')
        errors.push(...validateHits(`${pw}.hits`, part.hits, st.steps, [-36, 60]));
      else errors.push(...validateDrums(`${pw}.drums`, part.drums, st.steps, ins));
    });
  }
  for (const scene of SCENES) {
    if (!score.cues?.[score.scenes?.[scene]]) errors.push(`${at}.scenes.${scene} must name a cue`);
  }
  (score.triggers ?? []).forEach((t, i) => {
    if (!stingers[t.stinger])
      errors.push(`${at}.triggers[${i}] stinger "${t.stinger}" does not exist`);
    if (t.result !== undefined && t.result !== 'victory' && t.result !== 'defeat')
      errors.push(`${at}.triggers[${i}].result must be victory or defeat`);
  });
  const r = score.intensity;
  if (!r || typeof r !== 'object') errors.push(`${at}.intensity must be set`);
  else {
    const unit: (keyof IntensityRules)[] = [
      'calm',
      'enemyFloor',
      'enemyWeight',
      'dangerFrom',
      'dangerWeight',
      'heatWeight',
    ];
    for (const k of unit) if (!isNum(r[k], 0, 1)) errors.push(`${at}.intensity.${k} must be 0..1`);
    if (!isNum(r.enemiesFull, 1, 100)) errors.push(`${at}.intensity.enemiesFull must be 1..100`);
    for (const k of ['heatPerHit', 'heatPerKill'] as const)
      if (!isNum(r[k], 0, 1)) errors.push(`${at}.intensity.${k} must be 0..1`);
    if (!isNum(r.heatDecay, 0.01, 10))
      errors.push(`${at}.intensity.heatDecay must be 0.01..10 per second`);
    if (!isNum(r.rise, 0.1, 60)) errors.push(`${at}.intensity.rise must be 0.1..60 s`);
    if (!isNum(r.fall, 0.1, 120)) errors.push(`${at}.intensity.fall must be 0.1..120 s`);
  }
  return errors;
}
