import type GUI from 'lil-gui';
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
import type { Tuning } from '../../data/tuning';

type Mode = 'idle' | 'recording' | 'playing';

export interface ReplayControls {
  /** Call before every simulation step: records the live inputs, or injects the recorded ones. */
  beforeStep(world: World): void;
}

/** Record / stop / play / verify / export / import, in the panel. Playback uses the recorded tuning, then restores yours. */
export function createReplayControls(
  folder: GUI,
  world: World,
  refresh: () => void,
): ReplayControls {
  let mode: Mode = 'idle';
  let replay: Replay | null = null;
  let recorder: Recorder | null = null;
  let player: Player | null = null;
  let backup: Tuning | null = null;
  const status = { text: 'no recording' };

  const say = (text: string): void => {
    status.text = text;
    statusController.updateDisplay();
  };
  const fail = (e: unknown): void => say(`error: ${e instanceof Error ? e.message : String(e)}`);
  const seconds = (ticks: number): string => (ticks / 60).toFixed(1);

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

  folder
    .add(
      {
        record: () => {
          if (mode !== 'idle') return say(`busy (${mode})`);
          restartWorld(world, Date.now() >>> 0);
          recorder = startRecording(world);
          mode = 'recording';
          say('recording from a fresh run...');
        },
      },
      'record',
    )
    .name('Record (restarts the run)');
  folder
    .add(
      {
        stop: () => {
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
      },
      'stop',
    )
    .name('Stop');
  folder
    .add(
      {
        play: () => {
          if (mode !== 'idle') return say(`busy (${mode})`);
          if (!replay) return say('nothing recorded or imported yet');
          if (
            replay.tuning.weapons.bulletCap !== world.tuning.weapons.bulletCap ||
            replay.tuning.arena.enemyShotCap !== world.tuning.arena.enemyShotCap
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
      },
      'play',
    )
    .name('Play');
  folder
    .add(
      {
        verify: () => {
          if (!replay) return say('nothing recorded or imported yet');
          const same = hashWorld(runReplay(replay)) === replay.finalHash;
          say(
            same
              ? 'verify OK: headless run reproduces the recording'
              : 'verify FAILED: run differs (code changed since recording?)',
          );
        },
      },
      'verify',
    )
    .name('Verify (headless)');
  folder
    .add(
      {
        exportFile: () => {
          if (!replay) return say('nothing to export');
          const blob = new Blob([serializeReplay(replay)], { type: 'application/json' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `replay-${replay.seed}.json`;
          a.click();
          URL.revokeObjectURL(a.href);
          say(`exported replay-${replay.seed}.json`);
        },
      },
      'exportFile',
    )
    .name('Export file');
  folder
    .add(
      {
        importFile: () => {
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
      },
      'importFile',
    )
    .name('Import file...');
  const statusController = folder.add(status, 'text').name('status').disable();

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
