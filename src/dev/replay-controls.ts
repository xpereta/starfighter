import type { Tuning } from '../../data/tuning';
import { hashWorld } from '../core/replay/hash';
import {
  applyTuning,
  cloneTuning,
  createPlayer,
  parseReplay,
  restartWorld,
  runReplay,
  serializeReplay,
  startRecording,
  type Player,
  type Recorder,
  type Replay,
} from '../core/replay/replay';
import type { World } from '../core/world/world';
import { buttonRow, statusLine, type Row, type StatusLine, type UiContext } from './panel-ui';

type Mode = 'idle' | 'recording' | 'playing';

export interface ReplayControls {
  /** Call before every simulation step: records the live inputs, or injects the recorded ones. */
  beforeStep(world: World): void;
}

/** Where the controls put their rows (the panel's Replay section). */
export interface ReplayHost {
  add(row: Row): void;
  status(line: StatusLine): void;
}

/** Record / stop / play / verify / export / import. Playback uses the recorded tuning, then restores yours. */
export function createReplayControls(
  host: ReplayHost,
  ctx: UiContext,
  world: World,
  refresh: () => void,
): ReplayControls {
  let mode: Mode = 'idle';
  let replay: Replay | null = null;
  let recorder: Recorder | null = null;
  let player: Player | null = null;
  let backup: Tuning | null = null;
  const line = statusLine();
  line.set('no recording');
  const say = (text: string): void => line.set(text);
  const fail = (e: unknown): void => say(`error: ${e instanceof Error ? e.message : String(e)}`);
  const seconds = (ticks: number): string => (ticks / 60).toFixed(1);
  const button = (label: string, run: () => void, note: string): void =>
    host.add(buttonRow(ctx, label, run, note));

  function endPlayback(w: World): void {
    if (!replay) return;
    const matches = hashWorld(w) === replay.finalHash;
    if (backup) applyTuning(w.tuning, backup);
    backup = null;
    player = null;
    mode = 'idle';
    refresh();
    say(
      matches
        ? `playback done: matches the recording (${seconds(replay.ticks)} s)`
        : 'playback DIFFERS from the recording',
    );
  }

  button(
    'Record (restarts the run)',
    () => {
      if (mode !== 'idle') return say(`busy (${mode})`);
      restartWorld(world, Date.now() >>> 0);
      recorder = startRecording(world);
      mode = 'recording';
      say('recording from a fresh run...');
    },
    'Restarts the run from a new random seed and records your inputs, so the run can be replayed exactly.',
  );
  button(
    'Stop',
    () => {
      if (mode === 'recording' && recorder) {
        replay = recorder.finish(world);
        recorder = null;
        mode = 'idle';
        say(`recorded ${seconds(replay.ticks)} s, ${replay.inputs.length} input changes`);
      } else if (mode === 'playing') {
        if (backup) applyTuning(world.tuning, backup);
        backup = null;
        player = null;
        mode = 'idle';
        refresh();
        say('playback stopped');
      }
    },
    'Ends a recording (keeping it) or stops a playback.',
  );
  button(
    'Play',
    () => {
      if (mode !== 'idle') return say(`busy (${mode})`);
      if (!replay) return say('nothing recorded or imported yet');
      if (
        replay.tuning.weapons.bulletCap !== world.tuning.weapons.bulletCap ||
        replay.tuning.arena.enemyShotCap !== world.tuning.arena.enemyShotCap ||
        replay.tuning.missiles.missileCap !== world.tuning.missiles.missileCap
      ) {
        return say('error: replay uses different pool sizes than this build');
      }
      backup = cloneTuning(world.tuning);
      applyTuning(world.tuning, replay.tuning);
      restartWorld(world, replay.seed);
      player = createPlayer(replay);
      mode = 'playing';
      refresh();
      say('playing back (your tuning returns afterwards)');
    },
    'Plays the recording back with the tuning it was recorded with, then restores yours and says whether the result matches.',
  );
  button(
    'Verify (headless)',
    () => {
      if (!replay) return say('nothing recorded or imported yet');
      const same = hashWorld(runReplay(replay)) === replay.finalHash;
      say(
        same
          ? 'verify OK: headless run reproduces the recording'
          : 'verify FAILED: run differs (code changed since recording?)',
      );
    },
    'Re-runs the recording without drawing anything and checks that it ends in exactly the same state.',
  );
  button(
    'Export file',
    () => {
      if (!replay) return say('nothing to export');
      const blob = new Blob([serializeReplay(replay)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `replay-${replay.seed}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      say(`exported replay-${replay.seed}.json`);
    },
    'Downloads the recording as a file, for example to attach to a bug report.',
  );
  button(
    'Import file...',
    () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return;
        void file.text().then((text) => {
          try {
            replay = parseReplay(text);
            say(`imported ${file.name}: ${seconds(replay.ticks)} s`);
          } catch (e) {
            fail(e);
          }
        });
      };
      input.click();
    },
    'Loads a recording from a file. Invalid files are rejected with a message.',
  );
  host.status(line);

  return {
    beforeStep(w) {
      if (mode === 'recording' && recorder) {
        recorder.record(w.tick, w.actions);
      } else if (mode === 'playing' && player && replay) {
        if (w.tick >= player.ticks) endPlayback(w);
        else player.apply(w.actions, w.tick);
      }
    },
  };
}
