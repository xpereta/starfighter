import type { GameEvent } from '../core/events/events';
import {
  STEM_OFF,
  barSeconds,
  gateGain,
  stemNotes,
  stingerNotes,
  type IntensityRules,
  type Scene,
  type ScoreDef,
  type ScoreNote,
} from './score';

/** What the game tells the music, every frame (see `musicInputOf` in `state.ts`). */
export interface MusicInput {
  scene: Scene;
  /** Enemy fighters and turrets alive. */
  enemies: number;
  /** Player hull 0..1 (1 outside a run). */
  hull: number;
  /** Rescue progress of the pod being picked up, 0..1. */
  rescue: number;
}

export interface StemLevel {
  id: string;
  /** Final loudness 0..1: the gate's value times the stem's volume. */
  gain: number;
  /** Reverb send 0..1. */
  reverb: number;
}

/** One bar of the score, ready to schedule: everything decided; the backend only makes the notes. */
export interface BarPlan {
  /** Start on the audio clock (s). */
  time: number;
  /** Length of the bar (s). */
  seconds: number;
  cue: string;
  /** Bar inside the cue, 0-based. */
  bar: number;
  intensity: number;
  /** Seconds a stem takes to reach its new level. */
  fade: number;
  stems: StemLevel[];
  /** Notes with `at` in seconds from `time`. */
  notes: ScoreNote[];
  /** Looping audio files that start with this bar. */
  samples: { stem: string; file: string }[];
}

export interface StingerPlan {
  key: string;
  time: number;
  seconds: number;
  notes: ScoreNote[];
  /** How far the cue dips while it plays, 0..1 (0 = not at all). */
  duck: number;
  /** The cue is cut for the stinger's length (notes already scheduled are silenced by the backend). */
  mute: boolean;
}

export interface MusicStatus {
  scene: Scene;
  cue: string;
  bar: number;
  bars: number;
  intensity: number;
  target: number;
  heat: number;
  bpm: number;
  stems: { id: string; gain: number }[];
  /** The stinger now playing or about to play, or ''. */
  sting: string;
  /** What the panel forces, or null when the game decides. */
  forced: MusicForce | null;
  /** The keys of the score's stingers (set when the score starts). */
  stingers: string[];
}

/** The panel's override: a fixed scene and/or a fixed intensity (undefined = follow the game). */
export interface MusicForce {
  scene?: Scene;
  intensity?: number;
}

export interface ConductorStep {
  bars: BarPlan[];
  stingers: StingerPlan[];
}

export interface Conductor {
  setInput(input: MusicInput): void;
  force(force: MusicForce | null): void;
  /** Game events: they add heat and may call for a stinger. */
  onEvent(event: GameEvent, now: number): void;
  /** Asks for a stinger by key (it starts on its own quantize grid). */
  trigger(key: string, now: number): void;
  /** Starts (or restarts) the music: the first bar begins just after `now`. */
  reset(now: number): void;
  /** Once per frame: moves the intensity and returns the bars and stingers to schedule now. */
  step(now: number, dt: number): ConductorStep;
  readonly status: MusicStatus;
}

/** Bars and stingers are planned this far before they start (s): late enough to react, early enough to be on time. */
export const PLAN_AHEAD = 0.4;
/** The first bar starts this long after a reset (s). */
const START_DELAY = 0.12;
/** A stinger never starts before this (s), so it is scheduled in the future. */
const MIN_LEAD = 0.03;
/** The `threat` trigger fires at most this often (s). */
const THREAT_GAP = 12;

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** Where the intensity wants to go for this input, 0..1. Pure. */
export function intensityTarget(r: IntensityRules, input: MusicInput, heat: number): number {
  if (input.scene !== 'flight') return 0;
  let t = r.calm;
  if (input.enemies > 0) t += r.enemyFloor + r.enemyWeight * clamp01(input.enemies / r.enemiesFull);
  t += r.dangerWeight * clamp01((r.dangerFrom - input.hull) / Math.max(1e-6, r.dangerFrom));
  t += r.heatWeight * clamp01(heat);
  return clamp01(t);
}

/** One step of the intensity toward its target: quick to rise, slow to fall. Pure. */
export function followIntensity(
  current: number,
  target: number,
  dt: number,
  r: IntensityRules,
): number {
  const tau = target > current ? r.rise : r.fall;
  return current + (target - current) * (1 - Math.exp(-Math.max(0, dt) / tau));
}

export function createConductor(getScore: () => ScoreDef): Conductor {
  let input: MusicInput = { scene: 'menu', enemies: 0, hull: 1, rescue: 0 };
  let forced: MusicForce | null = null;
  let intensity = 0;
  let heat = 0;
  let nextBar = 0;
  let lastBar: { start: number; len: number } | null = null;
  let cue: { key: string; bar: number } | null = null;
  const prevGate = new Map<string, number>();
  let pending: { key: string; priority: number } | null = null;
  let playing: { key: string; end: number; priority: number } | null = null;
  let muteFrom = 0;
  let muteUntil = 0;
  let prevEnemies = 0;
  let lastThreat = -1e9;
  let started = false;
  let clock = 0;

  const status: MusicStatus = {
    scene: 'menu',
    cue: '',
    bar: 0,
    bars: 0,
    intensity: 0,
    target: 0,
    heat: 0,
    bpm: 0,
    stems: [],
    sting: '',
    forced: null,
    stingers: [],
  };

  const queue = (key: string): void => {
    const st = getScore().stingers[key];
    if (!st) return;
    if (playing && playing.end > clock && playing.priority > st.priority) return;
    if (pending) {
      const other = getScore().stingers[pending.key];
      if (other && other.priority > st.priority) return;
    }
    pending = { key, priority: st.priority };
  };

  /** The next time on the score's grid at or after `now` for a quantize rule (audio clock, s). */
  const gridTime = (now: number, q: 'now' | 'beat' | 'bar'): number => {
    const t0 = now + MIN_LEAD;
    if (q === 'now' || !lastBar) return t0;
    const unit = q === 'beat' ? lastBar.len / 4 : lastBar.len;
    const n = Math.ceil((t0 - lastBar.start) / unit - 1e-9);
    return lastBar.start + n * unit;
  };

  const sceneNow = (): Scene => forced?.scene ?? input.scene;

  const planBar = (score: ScoreDef): BarPlan | null => {
    const seconds = barSeconds(score.bpm);
    const wanted = score.scenes[sceneNow()];
    if (!cue || cue.key !== wanted) {
      const here = cue ? score.cues[cue.key] : undefined;
      // `phrase` cues finish their loop before a different scene takes over.
      if (!cue || !here || here.leave !== 'phrase' || cue.bar === 0) cue = { key: wanted, bar: 0 };
    }
    const def = score.cues[cue.key];
    if (!def) {
      nextBar += seconds;
      return null;
    }
    const sceneValue = sceneNow() === 'flight' ? intensity : (def.intensity ?? 0);
    const values = {
      intensity: sceneValue,
      rescue: clamp01(input.rescue),
      danger: clamp01(1 - input.hull),
    };
    const time = nextBar;
    const stems: StemLevel[] = [];
    const notes: ScoreNote[] = [];
    const samples: BarPlan['samples'] = [];
    for (const stem of def.stems) {
      const gate = gateGain(stem.gate, values[stem.gate.input]);
      const was = prevGate.get(stem.id) ?? 0;
      prevGate.set(stem.id, gate);
      stems.push({ id: stem.id, gain: gate * stem.volume, reverb: stem.reverb ?? 0 });
      if ((gate < STEM_OFF && was < STEM_OFF) || stem.volume <= 0) continue;
      if (stem.pattern.kind === 'sample') {
        if (cue.bar % stem.pattern.bars === 0)
          samples.push({ stem: stem.id, file: stem.pattern.file });
        continue;
      }
      for (const n of stemNotes(score, def, stem, cue.bar)) {
        const t = time + n.at;
        if (t < muteFrom || t >= muteUntil) notes.push(n);
      }
    }
    notes.sort((a, b) => a.at - b.at);
    const plan: BarPlan = {
      time,
      seconds,
      cue: cue.key,
      bar: cue.bar,
      intensity: sceneValue,
      fade: score.fade,
      stems,
      notes,
      samples,
    };
    status.cue = cue.key;
    status.bar = cue.bar;
    status.bars = def.bars;
    status.stems = stems.map((s) => ({ id: s.id, gain: s.gain }));
    lastBar = { start: time, len: seconds };
    nextBar = time + seconds;
    cue.bar = (cue.bar + 1) % def.bars;
    return plan;
  };

  return {
    setInput(next) {
      input = next;
    },
    force(f) {
      forced = f;
      status.forced = f;
    },
    onEvent(e, now) {
      clock = now;
      const score = getScore();
      const r = score.intensity;
      if (e.type === 'PlayerDamaged') heat = Math.min(1, heat + r.heatPerHit);
      else if (e.type === 'Killed') heat = Math.min(1, heat + r.heatPerKill);
      for (const t of score.triggers) {
        if (t.on !== e.type) continue;
        if (t.result && e.type === 'RunEnded' && e.result !== t.result) continue;
        if (t.minWave !== undefined && e.type === 'WaveStarted' && e.wave < t.minWave) continue;
        queue(t.stinger);
      }
    },
    trigger(key, now) {
      clock = now;
      queue(key);
    },
    reset(now) {
      started = true;
      clock = now;
      status.stingers = Object.keys(getScore().stingers);
      nextBar = now + START_DELAY;
      lastBar = null;
      cue = null;
      prevGate.clear();
      pending = null;
      playing = null;
      muteFrom = 0;
      muteUntil = 0;
      intensity = 0;
    },
    step(now, dt) {
      clock = now;
      const out: ConductorStep = { bars: [], stingers: [] };
      if (!started) return out;
      const score = getScore();
      const r = score.intensity;
      heat = Math.max(0, heat - r.heatDecay * dt);
      const target = forced?.intensity ?? intensityTarget(r, input, heat);
      intensity =
        forced?.intensity !== undefined
          ? forced.intensity
          : followIntensity(intensity, target, dt, r);
      status.scene = sceneNow();
      status.intensity = intensity;
      status.target = target;
      status.heat = heat;
      status.bpm = score.bpm;
      status.forced = forced;

      // The first enemies of a fight appear: a rising-threat sting (once in a while).
      if (
        sceneNow() === 'flight' &&
        prevEnemies === 0 &&
        input.enemies > 0 &&
        now - lastThreat > THREAT_GAP
      ) {
        lastThreat = now;
        for (const t of score.triggers) if (t.on === 'threat') queue(t.stinger);
      }
      prevEnemies = input.enemies;

      if (pending) {
        const st = score.stingers[pending.key];
        const key = pending.key;
        pending = null;
        if (st) {
          const time = gridTime(now, st.quantize);
          const seconds = (st.steps * barSeconds(score.bpm)) / 16;
          if (st.muteCue) {
            muteFrom = time;
            muteUntil = time + seconds;
          }
          playing = { key, end: time + seconds, priority: st.priority };
          out.stingers.push({
            key,
            time,
            seconds,
            notes: stingerNotes(score, st),
            duck: st.duck?.amount ?? 0,
            mute: st.muteCue === true,
          });
        }
      }
      if (playing && playing.end <= now) playing = null;
      status.sting = playing?.key ?? '';

      let guard = 0;
      while (nextBar < now + PLAN_AHEAD && guard++ < 4) {
        if (nextBar < now) nextBar = now + MIN_LEAD; // fell behind (a stalled frame): resume at once
        const plan = planBar(score);
        if (plan) out.bars.push(plan);
      }
      return out;
    },
    status,
  };
}
