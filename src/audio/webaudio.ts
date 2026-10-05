import type { SynthLayer } from '../render/style';
import type { AudioBackend, MixLevels, PlayRequest } from './backend';

/** Seconds of tail before a paused context is really suspended, so the pause blip is heard. */
const SUSPEND_DELAY_MS = 400;
/** Silence floor for exponential ramps (they cannot reach 0). */
const FLOOR = 0.0001;
const MIX_SMOOTH = 0.02;

/**
 * The Web Audio backend: synthesises each layer with an oscillator or looped noise, an envelope
 * and an optional filter, or plays a sample file. Browser only; the decisions are in `planner.ts`.
 */
export function createWebAudioBackend(urlOf: (file: string) => string | undefined): AudioBackend {
  let ctx: AudioContext | null = null;
  let master!: GainNode;
  let effects!: GainNode;
  let music!: GainNode;
  let duckGain!: GainNode;
  let noise: AudioBuffer | null = null;
  let suspendTimer: ReturnType<typeof setTimeout> | undefined;
  const samples = new Map<string, Promise<AudioBuffer | null>>();

  function noiseBuffer(c: AudioContext): AudioBuffer {
    if (noise) return noise;
    noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return noise;
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

  function layer(c: AudioContext, l: SynthLayer, req: PlayRequest, out: AudioNode): void {
    const t0 = c.currentTime + (l.delay ?? 0);
    const t1 = t0 + l.attack;
    const t2 = t1 + l.decay;
    const env = c.createGain();
    env.gain.setValueAtTime(FLOOR, t0);
    env.gain.linearRampToValueAtTime(Math.max(FLOOR, l.gain), t1);
    env.gain.exponentialRampToValueAtTime(FLOOR, t2);
    let tail: AudioNode = env;
    if (l.filter) {
      const f = c.createBiquadFilter();
      f.type = l.filter.type;
      f.Q.value = l.filter.q;
      f.frequency.setValueAtTime(l.filter.freq * req.pitch, t0);
      if (l.filter.freqEnd !== undefined)
        f.frequency.exponentialRampToValueAtTime(l.filter.freqEnd * req.pitch, t2);
      env.connect(f);
      tail = f;
    }
    tail.connect(out);
    if (l.waveform === 'noise') {
      const src = c.createBufferSource();
      src.buffer = noiseBuffer(c);
      src.loop = true;
      src.connect(env);
      src.start(t0);
      src.stop(t2 + 0.05);
    } else {
      const osc = c.createOscillator();
      osc.type = l.waveform;
      osc.frequency.setValueAtTime(l.freq * req.pitch, t0);
      if (l.freqEnd !== undefined)
        osc.frequency.exponentialRampToValueAtTime(l.freqEnd * req.pitch, t2);
      osc.connect(env);
      osc.start(t0);
      osc.stop(t2 + 0.05);
    }
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
        effects.connect(master);
        music.connect(duckGain).connect(master);
        master.connect(ctx.destination);
      }
      void ctx.resume();
    },
    play(req) {
      const c = ctx;
      if (!c || c.state !== 'running') return;
      const voice = c.createGain();
      voice.gain.value = req.volume;
      let out: AudioNode = voice;
      if (req.pan !== 0 && typeof c.createStereoPanner === 'function') {
        const p = c.createStereoPanner();
        p.pan.value = req.pan;
        voice.connect(p);
        out = p;
      }
      out.connect(effects);
      if (req.source.kind === 'synth') {
        for (const l of req.source.layers) layer(c, l, req, voice);
      } else {
        void sample(c, req.source.file).then((buf) => {
          if (!buf) return;
          const src = c.createBufferSource();
          src.buffer = buf;
          src.playbackRate.value = req.pitch;
          src.connect(voice);
          src.start();
        });
      }
    },
    setMix(mix: MixLevels) {
      if (!ctx) return;
      const t = ctx.currentTime;
      master.gain.setTargetAtTime(mix.master, t, MIX_SMOOTH);
      effects.gain.setTargetAtTime(mix.effects, t, MIX_SMOOTH);
      music.gain.setTargetAtTime(mix.music, t, MIX_SMOOTH);
    },
    setSuspended(suspended) {
      if (!ctx) return;
      clearTimeout(suspendTimer);
      if (suspended) {
        const c = ctx;
        suspendTimer = setTimeout(() => void c.suspend(), SUSPEND_DELAY_MS);
      } else void ctx.resume();
    },
    duck(amount, time) {
      if (!ctx) return;
      const t = ctx.currentTime;
      const g = duckGain.gain;
      g.cancelScheduledValues(t);
      g.setTargetAtTime(1 - amount, t, 0.03);
      g.setTargetAtTime(1, t + time, 0.25);
    },
  };
}
