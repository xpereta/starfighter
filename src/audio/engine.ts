import type { MixConfig } from '../../data/audio/mix';
import type { GameEvent } from '../core/events/events';
import type { MusicDef, SoundEventKey, SoundTable } from '../render/style';
import type { AudioBackend } from './backend';
import { createPlanner, type Listener } from './planner';

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
  /** Restarts the music from the active style (after the style or the track changed). */
  refreshMusic(): void;
  /** Forget gaps and voices (a style switch or a restart). */
  reset(): void;
}

export interface EngineOptions {
  backend: AudioBackend;
  /** The active style's table, read at every event so style switches and panel edits are live. */
  table: () => SoundTable;
  /** The active style's music track, or null. */
  music?: () => MusicDef | null;
  mix: MixConfig;
  /** Audio's own random stream (pitch spread). Never the simulation's. */
  rng?: () => number;
}

const ORIGIN: Listener = { x: 0, y: 0 };

export function createAudioEngine(o: EngineOptions): AudioEngine {
  const { backend, mix } = o;
  const planner = createPlanner(o.table, o.rng ?? Math.random);
  let unlocked = false;
  let paused = false;
  let muted = false;
  let sent = '';

  const play = (key: SoundEventKey, event: GameEvent | null, at: Listener, test = false): void => {
    const planned = planner.plan(key, event, at, backend.now, { test });
    if (!planned) return;
    backend.play(planned.request);
    if (planned.duck) backend.duck(planned.duck.amount, planned.duck.time);
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
      for (const e of events) play(e.type, e, listener);
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
      };
      const id = `${levels.master}|${levels.effects}|${levels.music}`;
      if (id === sent) return;
      sent = id;
      backend.setMix(levels);
    },
    playTest(key, listener = ORIGIN) {
      if (!unlocked) engine.unlock();
      play(key, null, listener, true);
    },
    refreshMusic() {
      if (unlocked) backend.setMusic(o.music?.() ?? null);
    },
    reset() {
      planner.reset();
    },
  };
  return engine;
}
