import type { MixConfig } from '../../data/audio/mix';
import type { GameEvent } from '../core/events/events';
import {
  silentLoopTable,
  type LoopKey,
  type LoopTable,
  type MusicDef,
  type SoundEventKey,
  type SoundTable,
} from '../render/style';
import type { AudioBackend } from './backend';
import {
  createLoopPlanner,
  previewLoopState,
  zeroLoopState,
  type LoopFrame,
  type LoopState,
} from './loops';
import {
  createConductor,
  type Conductor,
  type MusicForce,
  type MusicInput,
  type MusicStatus,
} from './conductor';
import { createPlanner, type Listener } from './planner';
import type { ScoreDef } from './score';

export interface AudioEngine {
  /** Starts the audio context; call from a key press or click. Events before this are dropped. */
  unlock(): void;
  readonly unlocked: boolean;
  /** Hand over the events of one simulation step (the same list the renderer gets). */
  consumeEvents(events: readonly GameEvent[], listener: Listener): void;
  /** The app's pause state. Plays the pause sound and suspends the effects (and back). */
  setPaused(paused: boolean): void;
  muted: boolean;
  toggleMute(): void;
  /** Once per frame: pushes the mix (master, effects, music, mute) to the backend when it changed. */
  update(): void;
  /** The panel's sound test: plays one sound now, ignoring gaps and voice limits. */
  playTest(key: SoundEventKey, listener?: Listener): void;
  /**
   * Once per frame while flying: the game values the loops follow (see `loopStateOf`) and the frame
   * length. Fades the loops and sends their levels to the backend. Does nothing while paused or locked.
   */
  setLoopState(state: LoopState, dt: number): void;
  /** What the loops are doing right now (for the panel readout): the state used and the loops on or fading. */
  readonly loopStatus: { state: LoopState; frames: readonly LoopFrame[] };
  /** The panel's loop preview: plays one loop as if the game were at `value` (0..1), or null for the real state. */
  previewLoop(key: LoopKey | null, value?: number): void;
  /** Restarts the music from the active style (after the style or the track changed). */
  refreshMusic(): void;
  /**
   * Once per frame: what the game tells an adaptive score (scene, enemies, hull, rescue) and the frame
   * length. Plans the next bars and stingers and hands them to the backend. Does nothing while paused,
   * locked, or when the style's music is not a score.
   */
  setMusicState(input: MusicInput, dt: number): void;
  /** What the score is doing right now (for the panel readout), or null when the music is not a score. */
  readonly musicStatus: MusicStatus | null;
  /** The panel's override: a fixed scene and/or intensity, or null to follow the game. */
  forceMusic(force: MusicForce | null): void;
  /** The panel's stinger test: plays one stinger of the score now (on its own grid). */
  playStinger(key: string): void;
  /** Forget gaps and voices (a style switch or a restart). */
  reset(): void;
}

export interface EngineOptions {
  backend: AudioBackend;
  /** The active style's table, read at every event so style switches and panel edits are live. */
  table: () => SoundTable;
  /** The active style's music track, or null. */
  music?: () => MusicDef | null;
  /** The active style's loop table (default: every loop silent). */
  loops?: () => LoopTable;
  mix: MixConfig;
  /** Audio's own random stream (pitch spread). Never the simulation's. */
  rng?: () => number;
}

const ORIGIN: Listener = { x: 0, y: 0 };

export function createAudioEngine(o: EngineOptions): AudioEngine {
  const { backend, mix } = o;
  const planner = createPlanner(o.table, o.rng ?? Math.random);
  const silentLoops = silentLoopTable();
  const loopTable = (): LoopTable => o.loops?.() ?? silentLoops;
  const loopPlanner = createLoopPlanner(loopTable);
  const loopStatus: { state: LoopState; frames: readonly LoopFrame[] } = {
    state: zeroLoopState(),
    frames: [],
  };
  let preview: { key: LoopKey; value: number } | null = null;
  let unlocked = false;
  let paused = false;
  let muted = false;
  let sent = '';
  // The adaptive score (when the style's music is one): the conductor plans, the backend plays.
  let score: ScoreDef | null = null;
  let scoreLevels = '';
  let forced: MusicForce | null = null;
  const conductor: Conductor = createConductor(() => score!);
  const currentScore = (): { score: ScoreDef; volume: number; sting: number } | null => {
    const def = o.music?.() ?? null;
    return def && def.source.kind === 'score'
      ? { score: def.source.score, volume: def.volume, sting: def.source.score.stingerLevel }
      : null;
  };
  const startScore = (): void => {
    const cur = currentScore();
    score = cur?.score ?? null;
    scoreLevels = cur ? `${cur.volume}|${cur.sting}` : '';
    backend.setScore(cur ? cur.volume : null, cur?.sting);
    if (cur) {
      conductor.reset(backend.now);
      conductor.force(forced);
    }
  };

  const play = (key: SoundEventKey, event: GameEvent | null, at: Listener, test = false): void => {
    const planned = planner.plan(key, event, at, backend.now, { test });
    if (!planned) return;
    backend.play(planned.request);
    if (planned.duck) backend.duck(planned.duck.amount, planned.duck.time, 'music');
    if (planned.duckLoops) backend.duck(planned.duckLoops.amount, planned.duckLoops.time, 'loops');
  };

  const engine: AudioEngine = {
    unlock() {
      if (unlocked) return;
      backend.start();
      unlocked = true;
      engine.refreshMusic();
      engine.update();
    },
    get unlocked() {
      return unlocked;
    },
    consumeEvents(events, listener) {
      if (!unlocked || paused) return;
      for (const e of events) {
        play(e.type, e, listener);
        if (score) conductor.onEvent(e, backend.now);
      }
    },
    setPaused(next) {
      if (next === paused) return;
      paused = next;
      if (!unlocked) return;
      if (next) {
        play('Paused', null, ORIGIN);
        backend.setSuspended(true);
      } else {
        backend.setSuspended(false);
        play('Resumed', null, ORIGIN);
      }
    },
    get muted() {
      return muted;
    },
    set muted(v: boolean) {
      muted = v;
      engine.update();
    },
    toggleMute() {
      engine.muted = !muted;
    },
    update() {
      if (!unlocked) return;
      const levels = {
        master: muted ? 0 : mix.master,
        effects: mix.effects,
        music: mix.music,
        reverb: mix.reverb,
        reverbTime: mix.reverbTime,
      };
      const id = `${levels.master}|${levels.effects}|${levels.music}|${levels.reverb}|${levels.reverbTime}`;
      if (id === sent) return;
      sent = id;
      backend.setMix(levels);
    },
    playTest(key, listener = ORIGIN) {
      if (!unlocked) engine.unlock();
      play(key, null, listener, true);
    },
    setLoopState(state, dt) {
      if (!unlocked || paused) return;
      const entry = preview ? loopTable()[preview.key] : undefined;
      const used =
        preview && entry && entry !== 'silent' ? previewLoopState(entry, preview.value) : state;
      loopStatus.state = used;
      loopStatus.frames = loopPlanner.step(used, dt);
      backend.setLoops(loopStatus.frames);
    },
    loopStatus,
    previewLoop(key, value = 1) {
      preview = key ? { key, value } : null;
    },
    refreshMusic() {
      if (!unlocked) return;
      const def = o.music?.() ?? null;
      backend.setMusic(def && def.source.kind === 'score' ? null : def);
      startScore();
    },
    setMusicState(input, dt) {
      if (!unlocked || paused) return;
      const cur = currentScore();
      if ((cur?.score ?? null) !== score) startScore(); // the style or the track changed
      if (!cur || !score) return;
      const levels = `${cur.volume}|${cur.sting}`;
      if (levels !== scoreLevels) {
        scoreLevels = levels;
        backend.setScore(cur.volume, cur.sting);
      }
      conductor.setInput(input);
      const step = conductor.step(backend.now, dt);
      for (const bar of step.bars) backend.playBar(bar);
      for (const sting of step.stingers) backend.playStinger(sting);
    },
    get musicStatus() {
      return score ? conductor.status : null;
    },
    forceMusic(force) {
      forced = force;
      conductor.force(force);
    },
    playStinger(key) {
      if (!unlocked) engine.unlock();
      if (score) conductor.trigger(key, backend.now);
    },
    reset() {
      planner.reset();
      loopPlanner.reset();
    },
  };
  return engine;
}
