import type { LoopLayer, MusicDef, SynthLayer } from '../render/style';
import { NOISE_WAVEFORMS } from '../render/style';
import type { AudioBackend, DuckBus, MixLevels, PlayRequest } from './backend';
import type { BarPlan, StingerPlan } from './conductor';
import type { LoopFrame } from './loops';
import { loopLength, loopNotes, type LoopSource } from './music';
import type { PitchedNote, ScoreNote } from './score';

/** Seconds of tail before a paused context is really suspended, so the pause blip is heard. */
const SUSPEND_DELAY_MS = 400;
/** Silence floor for exponential ramps (they cannot reach 0). */
const FLOOR = 0.0001;
const MIX_SMOOTH = 0.02;
/** Smoothing of loop levels between two frames (s). The planner already fades; this only removes steps. */
const LOOP_SMOOTH = 0.04;
/** The music scheduler wakes this often and plans this far ahead (ms, s). */
const MUSIC_TICK_MS = 250;
const MUSIC_AHEAD = 1;
/** Seconds of noise in each noise buffer. */
const NOISE_SECONDS = 4;
/** The output ceiling: the safety limiter keeps the peak at or below this (full scale = 1). */
export const OUTPUT_CEILING = 0.9;

type Noise = 'noise' | 'pink' | 'brown';

/** The waveshaper curve for a drive 0..1: soft saturation, gain-compensated. */
export function distortionCurve(drive: number, size = 1024): Float32Array<ArrayBuffer> {
  const k = 1 + drive * 60;
  const curve = new Float32Array(size);
  const norm = Math.tanh(k);
  for (let i = 0; i < size; i++) {
    const x = (i / (size - 1)) * 2 - 1;
    curve[i] = Math.tanh(k * x) / norm;
  }
  return curve;
}

/** The last stage: linear up to 0.7, then a soft knee that tops out just under `OUTPUT_CEILING`. */
export function ceilingCurve(size = 2048): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(size);
  const knee = 0.7;
  const room = OUTPUT_CEILING - knee;
  for (let i = 0; i < size; i++) {
    const x = (i / (size - 1)) * 2 - 1;
    const a = Math.abs(x);
    const y = a <= knee ? a : knee + room * Math.tanh((a - knee) / room);
    curve[i] = Math.sign(x) * y;
  }
  return curve;
}

/**
 * A synthetic room: stereo noise that decays exponentially over `seconds` and gets darker as it
 * does (the high frequencies die first, like real air and walls).
 */
export function impulseResponse(
  channels: Float32Array[],
  sampleRate: number,
  random: () => number = Math.random,
): void {
  const length = channels[0]!.length;
  for (const data of channels) {
    let lp = 0;
    for (let i = 0; i < length; i++) {
      const t = i / length;
      const decay = Math.exp(-6.9 * t); // -60 dB at the end
      const a = 0.65 - 0.58 * t; // one-pole low-pass: bright at first, dark in the tail
      lp += (random() * 2 - 1 - lp) * a;
      // A short fade-in so the reverb does not click against the dry sound.
      const fade = Math.min(1, i / (sampleRate * 0.004));
      data[i] = lp * decay * fade;
    }
  }
}

/**
 * The Web Audio backend: synthesises each layer (oscillator or coloured noise, a waveshaper, a
 * filter, an envelope, a tremolo) or plays a sample file; sends every sound through its own pan,
 * distance low-pass and reverb send; keeps the continuous loops running; and ends in a safety
 * limiter. Browser only; the decisions are in `planner.ts` and `loops.ts`.
 */
export function createWebAudioBackend(urlOf: (file: string) => string | undefined): AudioBackend {
  let ctx: AudioContext | null = null;
  let master!: GainNode;
  let effects!: GainNode;
  let music!: GainNode;
  let duckGain!: GainNode;
  let loopBus!: GainNode;
  let loopDuck!: GainNode;
  let reverbIn!: GainNode;
  let reverbOut!: GainNode;
  let convolver!: ConvolverNode;
  let reverbSeconds = 0;
  // The adaptive score: stems -> scoreBus (track volume) -> duckGain -> music; stingers skip the duck.
  let scoreBus: GainNode | null = null;
  let scoreMute: GainNode | null = null;
  let stingBus: GainNode | null = null;
  let scoreVerbIn!: GainNode;
  let scoreVerb: ConvolverNode | null = null;
  const stems = new Map<string, { gain: GainNode; send: GainNode }>();
  const noises = new Map<Noise, AudioBuffer>();
  const curves = new Map<number, Float32Array<ArrayBuffer>>();
  let suspendTimer: ReturnType<typeof setTimeout> | undefined;
  let musicTimer: ReturnType<typeof setInterval> | undefined;
  let musicStop: (() => void) | null = null;
  const samples = new Map<string, Promise<AudioBuffer | null>>();
  const loops = new Map<string, LoopVoice>();

  interface LoopVoice {
    signature: string;
    out: GainNode;
    send: GainNode;
    oscs: { node: OscillatorNode; freq: number }[];
    filters: { node: BiquadFilterNode; freq: number }[];
    stop(): void;
  }

  function noiseBuffer(c: AudioContext, kind: Noise): AudioBuffer {
    const have = noises.get(kind);
    if (have) return have;
    const buf = c.createBuffer(1, c.sampleRate * NOISE_SECONDS, c.sampleRate);
    const data = buf.getChannelData(0);
    if (kind === 'noise') {
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    } else if (kind === 'pink') {
      // Paul Kellet's economical pink-noise filter.
      let b0 = 0,
        b1 = 0,
        b2 = 0,
        b3 = 0,
        b4 = 0,
        b5 = 0,
        b6 = 0;
      for (let i = 0; i < data.length; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    } else {
      let last = 0;
      for (let i = 0; i < data.length; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        data[i] = last * 3.5;
      }
    }
    noises.set(kind, buf);
    return buf;
  }

  /** A waveshaper node of its own per layer (a shared one would add its inputs before bending them); the curves are cached. */
  function shaper(c: AudioContext, drive: number): WaveShaperNode {
    const key = Math.round(drive * 20); // 21 distinct curves are plenty
    let curve = curves.get(key);
    if (!curve) {
      curve = distortionCurve(key / 20);
      curves.set(key, curve);
    }
    const node = c.createWaveShaper();
    node.curve = curve;
    node.oversample = '2x';
    return node;
  }

  function buildReverb(c: AudioContext, seconds: number): void {
    const length = Math.max(1, Math.round(c.sampleRate * seconds));
    const buf = c.createBuffer(2, length, c.sampleRate);
    impulseResponse([buf.getChannelData(0), buf.getChannelData(1)], c.sampleRate);
    convolver.buffer = buf;
    reverbSeconds = seconds;
  }

  function sample(c: AudioContext, file: string): Promise<AudioBuffer | null> {
    let p = samples.get(file);
    if (!p) {
      const url = urlOf(file);
      p = url
        ? fetch(url)
            .then((r) => r.arrayBuffer())
            .then((b) => c.decodeAudioData(b))
            .catch(() => null)
        : Promise.resolve(null);
      if (!url) console.warn(`sound sample "${file}" not found`);
      samples.set(file, p);
    }
    return p;
  }

  /** Oscillator or noise source for a layer; returns the node and starts it at `t0`. */
  function source(
    c: AudioContext,
    waveform: SynthLayer['waveform'],
    freq: number,
    detune: number | undefined,
    t0: number,
    t2: number,
  ): AudioScheduledSourceNode {
    if ((NOISE_WAVEFORMS as readonly string[]).includes(waveform)) {
      const src = c.createBufferSource();
      src.buffer = noiseBuffer(c, waveform as Noise);
      src.loop = true;
      src.start(t0, Math.random() * (NOISE_SECONDS - 0.5));
      src.stop(t2 + 0.05);
      return src;
    }
    const osc = c.createOscillator();
    osc.type = waveform as OscillatorType;
    osc.frequency.setValueAtTime(freq, t0);
    if (detune) osc.detune.value = detune;
    osc.start(t0);
    osc.stop(t2 + 0.05);
    return osc;
  }

  function tremolo(
    c: AudioContext,
    t: { rate: number; depth: number; shape?: 'sine' | 'square' | 'triangle' },
    into: AudioNode,
    out: AudioNode,
    t0?: number,
    t2?: number,
  ): OscillatorNode {
    const g = c.createGain();
    g.gain.value = 1 - t.depth / 2;
    const lfo = c.createOscillator();
    lfo.type = t.shape ?? 'sine';
    lfo.frequency.value = t.rate;
    const depth = c.createGain();
    depth.gain.value = t.depth / 2;
    lfo.connect(depth).connect(g.gain);
    into.connect(g).connect(out);
    lfo.start(t0 ?? c.currentTime);
    if (t2 !== undefined) lfo.stop(t2 + 0.05);
    return lfo;
  }

  function layer(c: AudioContext, l: SynthLayer, req: PlayRequest, out: AudioNode): void {
    layerAt(c, l, c.currentTime + req.startDelay, req.pitch, out);
  }

  /** One synthesised layer starting at `base` (+ its own delay) on the audio clock, at a pitch multiplier. */
  function layerAt(
    c: AudioContext,
    l: SynthLayer,
    base: number,
    pitch: number,
    out: AudioNode,
  ): void {
    const req = { pitch };
    const t0 = base + (l.delay ?? 0);
    const t1 = t0 + l.attack;
    const th = t1 + (l.hold ?? 0);
    const t2 = th + l.decay;
    const env = c.createGain();
    env.gain.setValueAtTime(FLOOR, t0);
    env.gain.linearRampToValueAtTime(Math.max(FLOOR, l.gain), t1);
    if (l.hold) env.gain.setValueAtTime(Math.max(FLOOR, l.gain), th);
    env.gain.exponentialRampToValueAtTime(FLOOR, t2);

    const src = source(c, l.waveform, l.freq * req.pitch, l.detune, t0, t2);
    if (src instanceof OscillatorNode && l.freqEnd !== undefined)
      src.frequency.exponentialRampToValueAtTime(l.freqEnd * req.pitch, t2);

    // source -> [waveshaper] -> [filter] -> envelope -> [tremolo] -> out
    let head: AudioNode = src;
    if (l.distortion) {
      const ws = shaper(c, l.distortion);
      head.connect(ws);
      head = ws;
    }
    if (l.filter) {
      const f = c.createBiquadFilter();
      f.type = l.filter.type;
      f.Q.value = l.filter.q;
      f.frequency.setValueAtTime(l.filter.freq * req.pitch, t0);
      if (l.filter.freqEnd !== undefined)
        f.frequency.exponentialRampToValueAtTime(l.filter.freqEnd * req.pitch, t2);
      head.connect(f);
      head = f;
    }
    head.connect(env);
    if (l.tremolo) tremolo(c, l.tremolo, env, out, t0, t2);
    else env.connect(out);
  }

  function stopMusic(): void {
    clearInterval(musicTimer);
    musicStop?.();
    musicStop = null;
  }

  function playLoop(c: AudioContext, loop: LoopSource, out: AudioNode): void {
    const length = loopLength(loop);
    const notes = loopNotes(loop);
    let next = c.currentTime + 0.05;
    const schedule = (): void => {
      while (next < c.currentTime + MUSIC_AHEAD) {
        for (const n of notes) {
          const t0 = next + n.at;
          const env = c.createGain();
          env.gain.setValueAtTime(FLOOR, t0);
          env.gain.linearRampToValueAtTime(n.gain, t0 + 0.01);
          env.gain.exponentialRampToValueAtTime(FLOOR, t0 + n.length);
          const osc = c.createOscillator();
          osc.type = n.bass ? 'sine' : loop.waveform;
          osc.frequency.value = n.freq;
          if (n.bass) {
            osc.connect(env);
          } else {
            const f = c.createBiquadFilter();
            f.type = 'lowpass';
            f.frequency.value = Math.min(8000, n.freq * 6);
            osc.connect(f).connect(env);
          }
          env.connect(out);
          osc.start(t0);
          osc.stop(t0 + n.length + 0.05);
        }
        next += length;
      }
    };
    schedule();
    musicTimer = setInterval(schedule, MUSIC_TICK_MS);
  }

  function buildLoop(c: AudioContext, frame: LoopFrame): LoopVoice {
    const out = c.createGain();
    out.gain.value = 0;
    const send = c.createGain();
    send.gain.value = frame.send;
    out.connect(loopBus);
    out.connect(send).connect(reverbIn);
    const oscs: LoopVoice['oscs'] = [];
    const filters: LoopVoice['filters'] = [];
    const stops: (() => void)[] = [];
    const now = c.currentTime;
    for (const l of frame.layers as readonly LoopLayer[]) {
      const src = source(c, l.waveform, l.freq, l.detune, now, now + 1e6);
      if (src instanceof OscillatorNode) oscs.push({ node: src, freq: l.freq });
      let head: AudioNode = src;
      if (l.distortion) {
        const ws = shaper(c, l.distortion);
        head.connect(ws);
        head = ws;
      }
      if (l.filter) {
        const f = c.createBiquadFilter();
        f.type = l.filter.type;
        f.Q.value = l.filter.q;
        f.frequency.value = l.filter.freq;
        head.connect(f);
        head = f;
        filters.push({ node: f, freq: l.filter.freq });
      }
      const g = c.createGain();
      g.gain.value = l.gain;
      head.connect(g);
      if (l.tremolo) {
        const lfo = tremolo(c, l.tremolo, g, out);
        stops.push(() => lfo.stop());
      } else g.connect(out);
      stops.push(() => src.stop());
    }
    return {
      signature: frame.signature,
      out,
      send,
      oscs,
      filters,
      stop() {
        for (const s of stops) {
          try {
            s();
          } catch {
            // Already stopped.
          }
        }
        out.disconnect();
        send.disconnect();
      },
    };
  }

  /** Length of the score's own hall (s) and how loud its return is next to the dry stems. */
  const SCORE_VERB_SECONDS = 3.4;
  const SCORE_VERB_LEVEL = 0.7;
  /** Level of the stingers' send into the shared space reverb. */
  const STING_SEND = 0.25;

  function ensureScore(c: AudioContext): void {
    if (scoreBus) return;
    scoreBus = c.createGain();
    scoreBus.gain.value = 0;
    scoreMute = c.createGain();
    scoreBus.connect(scoreMute).connect(duckGain);
    stingBus = c.createGain();
    stingBus.connect(music);
    const stingSend = c.createGain();
    stingSend.gain.value = STING_SEND;
    stingBus.connect(stingSend).connect(reverbIn);
    scoreVerbIn = c.createGain();
    scoreVerb = c.createConvolver();
    const length = Math.round(c.sampleRate * SCORE_VERB_SECONDS);
    const buf = c.createBuffer(2, length, c.sampleRate);
    impulseResponse([buf.getChannelData(0), buf.getChannelData(1)], c.sampleRate);
    scoreVerb.buffer = buf;
    const wet = c.createGain();
    wet.gain.value = SCORE_VERB_LEVEL;
    scoreVerbIn.connect(scoreVerb).connect(wet).connect(scoreBus);
  }

  function stopScore(): void {
    for (const s of stems.values()) {
      s.gain.disconnect();
      s.send.disconnect();
    }
    stems.clear();
    scoreBus?.disconnect();
    scoreMute?.disconnect();
    stingBus?.disconnect();
    scoreVerbIn?.disconnect();
    scoreVerb?.disconnect();
    scoreBus = null;
    scoreMute = null;
    stingBus = null;
    scoreVerb = null;
  }

  function stemNode(c: AudioContext, id: string): { gain: GainNode; send: GainNode } {
    let s = stems.get(id);
    if (!s) {
      const gain = c.createGain();
      gain.gain.value = 0;
      const send = c.createGain();
      send.gain.value = 0;
      gain.connect(scoreBus!);
      gain.connect(send).connect(scoreVerbIn);
      s = { gain, send };
      stems.set(id, s);
    }
    return s;
  }

  /** One pitched score note: voices -> [grit] -> [filter that sweeps] -> ADSR envelope -> out. */
  function pitchedNote(c: AudioContext, n: PitchedNote, t0: number, out: AudioNode): void {
    const ins = n.instrument;
    const peak = Math.max(FLOOR, ins.gain * n.vel);
    const tEnd = t0 + Math.max(n.length, ins.attack + 0.01);
    const stopAt = tEnd + ins.release * 1.3 + 0.05;
    const env = c.createGain();
    env.gain.setValueAtTime(FLOOR, t0);
    env.gain.linearRampToValueAtTime(peak, t0 + ins.attack);
    env.gain.setTargetAtTime(Math.max(FLOOR, peak * ins.sustain), t0 + ins.attack, ins.decay / 3);
    env.gain.setTargetAtTime(0, tEnd, ins.release / 4);
    env.connect(out);
    let head: AudioNode = env;
    // Build back to front: the voices feed `mix`, which goes through the optional stages into `env`.
    const mix = c.createGain();
    let tail: AudioNode = mix;
    if (ins.distortion) {
      const ws = shaper(c, ins.distortion);
      tail.connect(ws);
      tail = ws;
    }
    if (ins.filter) {
      const f = c.createBiquadFilter();
      f.type = ins.filter.type;
      f.Q.value = ins.filter.q;
      const follow = (n.freq / 261.6) ** (ins.filter.track ?? 0);
      f.frequency.setValueAtTime(ins.filter.freq * follow, t0);
      if (ins.filter.freqEnd !== undefined)
        f.frequency.setTargetAtTime(ins.filter.freqEnd * follow, t0 + ins.attack, ins.decay / 3);
      tail.connect(f);
      tail = f;
    }
    tail.connect(head);
    head = mix;
    let lfoGain: GainNode | null = null;
    if (ins.vibrato) {
      const lfo = c.createOscillator();
      lfo.frequency.value = ins.vibrato.rate;
      lfoGain = c.createGain();
      lfoGain.gain.setValueAtTime(0, t0);
      lfoGain.gain.linearRampToValueAtTime(ins.vibrato.depth, t0 + (ins.vibrato.delay ?? 0) + 0.3);
      lfo.connect(lfoGain);
      lfo.start(t0);
      lfo.stop(stopAt);
    }
    for (const v of ins.voices) {
      const osc = c.createOscillator();
      osc.type = v.waveform;
      osc.frequency.value = n.freq * 2 ** (v.octave ?? 0);
      osc.detune.value = v.detune ?? 0;
      lfoGain?.connect(osc.detune);
      const vg = c.createGain();
      vg.gain.value = v.gain;
      osc.connect(vg).connect(head);
      osc.start(t0);
      osc.stop(stopAt);
    }
  }

  function scoreNote(c: AudioContext, n: ScoreNote, t0: number, out: AudioNode): void {
    if (n.kind === 'pitched') {
      pitchedNote(c, n, t0, out);
      return;
    }
    const hit = c.createGain();
    hit.gain.value = n.vel * n.gain;
    hit.connect(out);
    for (const l of n.layers) layerAt(c, l, t0, 1, hit);
  }

  return {
    get now() {
      return ctx ? ctx.currentTime : 0;
    },
    start() {
      if (!ctx) {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        ctx = new Ctor();
        master = ctx.createGain();
        effects = ctx.createGain();
        music = ctx.createGain();
        duckGain = ctx.createGain();
        loopBus = ctx.createGain();
        loopDuck = ctx.createGain();
        reverbIn = ctx.createGain();
        reverbOut = ctx.createGain();
        convolver = ctx.createConvolver();
        reverbIn.connect(convolver).connect(reverbOut).connect(effects);
        loopBus.connect(loopDuck).connect(effects);
        effects.connect(master);
        duckGain.connect(music);
        music.connect(master);
        // The safety stage: a limiter, then a soft ceiling so nothing ever clips at the output.
        const limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = -10;
        limiter.knee.value = 8;
        limiter.ratio.value = 10;
        limiter.attack.value = 0.003;
        limiter.release.value = 0.2;
        const ceiling = ctx.createWaveShaper();
        ceiling.curve = ceilingCurve();
        master.connect(limiter).connect(ceiling).connect(ctx.destination);
        buildReverb(ctx, 2.6);
      }
      void ctx.resume();
    },
    play(req) {
      const c = ctx;
      if (!c || c.state !== 'running') return;
      const voice = c.createGain();
      voice.gain.value = req.volume;
      // voice -> [distance low-pass] -> (reverb send) -> [pan] -> effects
      let head: AudioNode = voice;
      if (req.cutoff > 0) {
        const f = c.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = req.cutoff;
        f.Q.value = 0.5;
        voice.connect(f);
        head = f;
      }
      if (req.send > 0) {
        const send = c.createGain();
        send.gain.value = req.send;
        head.connect(send);
        let tail: AudioNode = send;
        if (req.preDelay > 0) {
          const d = c.createDelay(0.6);
          d.delayTime.value = req.preDelay;
          send.connect(d);
          tail = d;
        }
        tail.connect(reverbIn);
      }
      if (req.pan !== 0 && typeof c.createStereoPanner === 'function') {
        const p = c.createStereoPanner();
        p.pan.value = req.pan;
        head.connect(p);
        head = p;
      }
      head.connect(effects);
      if (req.source.kind === 'synth') {
        for (const l of req.source.layers) layer(c, l, req, voice);
      } else {
        void sample(c, req.source.file).then((buf) => {
          if (!buf) return;
          const src = c.createBufferSource();
          src.buffer = buf;
          src.playbackRate.value = req.pitch;
          src.connect(voice);
          src.start(c.currentTime + req.startDelay);
        });
      }
    },
    setMix(mix: MixLevels) {
      if (!ctx) return;
      const t = ctx.currentTime;
      master.gain.setTargetAtTime(mix.master, t, MIX_SMOOTH);
      effects.gain.setTargetAtTime(mix.effects, t, MIX_SMOOTH);
      music.gain.setTargetAtTime(mix.music, t, MIX_SMOOTH);
      reverbOut.gain.setTargetAtTime(mix.reverb, t, MIX_SMOOTH);
      if (Math.abs(mix.reverbTime - reverbSeconds) > 0.04) buildReverb(ctx, mix.reverbTime);
    },
    setSuspended(suspended) {
      if (!ctx) return;
      clearTimeout(suspendTimer);
      if (suspended) {
        const c = ctx;
        suspendTimer = setTimeout(() => void c.suspend(), SUSPEND_DELAY_MS);
      } else void ctx.resume();
    },
    setMusic(def: MusicDef | null) {
      stopMusic();
      const c = ctx;
      if (!c || !def) return;
      const track = c.createGain();
      track.gain.value = def.volume;
      track.connect(duckGain);
      musicStop = () => track.disconnect();
      if (def.source.kind === 'loop') {
        playLoop(c, def.source, track);
      } else if (def.source.kind === 'sample') {
        let live = true;
        let src: AudioBufferSourceNode | null = null;
        musicStop = () => {
          live = false;
          src?.stop();
          track.disconnect();
        };
        void sample(c, def.source.file).then((buf) => {
          if (!buf || !live) return;
          src = c.createBufferSource();
          src.buffer = buf;
          src.loop = true;
          src.connect(track);
          src.start();
        });
      }
    },
    duck(amount, time, bus: DuckBus = 'music') {
      if (!ctx) return;
      const t = ctx.currentTime;
      const g = (bus === 'loops' ? loopDuck : duckGain).gain;
      g.cancelScheduledValues(t);
      g.setTargetAtTime(1 - amount, t, 0.03);
      g.setTargetAtTime(1, t + time, 0.25);
    },
    setScore(volume, stingerLevel = 1) {
      const c = ctx;
      if (!c) return;
      if (volume === null) {
        stopScore();
        return;
      }
      ensureScore(c);
      scoreBus!.gain.setTargetAtTime(volume, c.currentTime, 0.05);
      stingBus!.gain.setTargetAtTime(volume * stingerLevel, c.currentTime, 0.05);
    },
    playBar(plan: BarPlan) {
      const c = ctx;
      if (!c || !scoreBus || c.state !== 'running') return;
      const fadeAt = Math.max(c.currentTime, plan.time - 0.05);
      for (const level of plan.stems) {
        const node = stemNode(c, level.id);
        node.gain.gain.setTargetAtTime(level.gain, fadeAt, plan.fade / 3);
        node.send.gain.setTargetAtTime(level.reverb, fadeAt, plan.fade / 3);
      }
      for (const n of plan.notes) scoreNote(c, n, plan.time + n.at, stemNode(c, n.stem).gain);
      for (const s of plan.samples) {
        const node = stemNode(c, s.stem);
        void sample(c, s.file).then((buf) => {
          if (!buf || !scoreBus) return;
          const src = c.createBufferSource();
          src.buffer = buf;
          src.connect(node.gain);
          src.start(Math.max(c.currentTime, plan.time));
        });
      }
    },
    playStinger(plan: StingerPlan) {
      const c = ctx;
      if (!c || !stingBus || c.state !== 'running') return;
      for (const n of plan.notes) scoreNote(c, n, plan.time + n.at, stingBus);
      if (plan.mute && scoreMute) {
        // A dramatic silence: the cue (including what is already scheduled) is cut for the stinger.
        const m = scoreMute.gain;
        m.setTargetAtTime(0, Math.max(c.currentTime, plan.time - 0.01), 0.02);
        m.setTargetAtTime(1, plan.time + plan.seconds, 0.12);
      }
      if (plan.duck > 0) {
        const g = duckGain.gain;
        g.setTargetAtTime(1 - plan.duck, Math.max(c.currentTime, plan.time - 0.02), 0.05);
        g.setTargetAtTime(1, plan.time + plan.seconds, 0.4);
      }
    },
    setLoops(frames) {
      const c = ctx;
      if (!c) return;
      const t = c.currentTime;
      const live = new Set<string>();
      for (const f of frames) {
        live.add(f.key);
        let v = loops.get(f.key);
        if (v && v.signature !== f.signature) {
          v.stop();
          loops.delete(f.key);
          v = undefined;
        }
        if (!v) {
          v = buildLoop(c, f);
          loops.set(f.key, v);
        }
        v.out.gain.setTargetAtTime(f.gain, t, LOOP_SMOOTH);
        v.send.gain.setTargetAtTime(f.send, t, LOOP_SMOOTH);
        for (const o of v.oscs) o.node.frequency.setTargetAtTime(o.freq * f.pitch, t, LOOP_SMOOTH);
        for (const fl of v.filters)
          fl.node.frequency.setTargetAtTime(fl.freq * f.cutoff, t, LOOP_SMOOTH);
      }
      for (const [key, v] of loops) {
        if (live.has(key)) continue;
        v.stop();
        loops.delete(key);
      }
    },
  };
}
