import GUI from 'lil-gui';
import { createTuning, tuningParams, type Tuning } from '../../data/tuning';
import type { ParamDef } from '../core/params/params';
import type { World } from '../core/world/world';
import { createReplayControls, type ReplayControls } from './replay-controls';
import {
  applyPreset,
  diffFromDefaults,
  formatDefaultsPatch,
  parsePreset,
  RELOAD_ONLY,
  serializePreset,
  TOGGLES,
  TUNED_GROUPS,
  type TunedGroup,
} from './presets';

const STORAGE_KEY = 'starfighter.presets';

type Group = Record<string, number | string | boolean>;

function readStore(): Record<string, string> {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return typeof raw === 'object' && raw !== null ? (raw as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeStore(presets: Record<string, string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // Storage blocked: presets can still be exported to a file.
  }
}

/** A step that gives about 200 notches across a parameter's range. */
function stepFor(def: ParamDef): number {
  return 10 ** Math.floor(Math.log10((def.max - def.min) / 200));
}

export interface Panel {
  readonly debug: { overlay: boolean };
  readonly replay: ReplayControls;
  dispose(): void;
}

/** Live tuning panel (lil-gui) generated from the parameter definitions: ranges and units come from data/tuning. */
export function createPanel(world: World): Panel {
  const tuning: Tuning = world.tuning;
  const defaults = createTuning();
  const gui = new GUI({ title: 'Tuning (` = debug overlay)' });
  const debug = { overlay: false };
  const status = { text: 'ready' };
  const say = (text: string): void => {
    status.text = text;
    statusController.updateDisplay();
  };
  const refresh = (): void => gui.controllersRecursive().forEach((c) => c.updateDisplay());

  // A clicked button keeps focus, and then Space (fire) would click it again.
  gui.domElement.addEventListener('click', (e) => {
    if (e.target instanceof HTMLElement && e.target.closest('button')) {
      (document.activeElement as HTMLElement | null)?.blur();
    }
  });

  const folders: Record<string, GUI> = {};
  const folder = (name: string): GUI => (folders[name] ??= gui.addFolder(name).close());

  const labels: Record<TunedGroup, (key: string) => string> = {
    flight: (k) => (k.startsWith('evade') ? 'Evade' : 'Flight'),
    camera: () => 'Camera',
    weapons: () => 'Guns',
  };
  for (const group of TUNED_GROUPS) {
    const values = tuning[group] as unknown as Group;
    const defs: Record<string, ParamDef> = tuningParams[group];
    for (const [key, def] of Object.entries(defs)) {
      if (RELOAD_ONLY.has(key)) continue; // pool sizes only apply at world creation
      folder(labels[group](key))
        .add(values, key, def.min, def.max, stepFor(def))
        .name(`${key} [${def.unit}]`);
    }
    for (const [key, options] of Object.entries(TOGGLES[group])) {
      const isBool = typeof options[0] === 'boolean';
      const target = folder(labels[group](key));
      if (isBool) target.add(values, key).name(key);
      else target.add(values, key, [...options] as string[]).name(key);
    }
  }
  folder('Flight').open();

  // Presets: named, in browser storage, plus file export/import.
  const presets = folder('Presets');
  const state = { name: 'my-preset', saved: '' };
  let savedController = presets.add(state, 'saved', ['']).name('saved presets');
  const rebuildSaved = (): void => {
    const names = Object.keys(readStore());
    savedController.destroy();
    savedController = presets
      .add(state, 'saved', names.length ? names : [''])
      .name('saved presets');
    state.saved = names.includes(state.saved) ? state.saved : (names[0] ?? '');
    savedController.updateDisplay();
  };
  const run = (label: string, fn: () => void): void => {
    try {
      fn();
      refresh();
      say(label);
    } catch (e) {
      say(`error: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  presets.add(state, 'name').name('name');
  presets
    .add(
      {
        save: () =>
          run(`saved "${state.name}"`, () => {
            writeStore({ ...readStore(), [state.name]: serializePreset(tuning, state.name) });
            state.saved = state.name;
            rebuildSaved();
          }),
      },
      'save',
    )
    .name('Save');
  presets
    .add(
      {
        load: () =>
          run(`loaded "${state.saved}"`, () => {
            const text = readStore()[state.saved];
            if (!text) throw new Error('no preset selected');
            applyPreset(tuning, parsePreset(text));
          }),
      },
      'load',
    )
    .name('Load selected');
  presets
    .add(
      {
        remove: () =>
          run(`deleted "${state.saved}"`, () => {
            const all = readStore();
            delete all[state.saved];
            writeStore(all);
            rebuildSaved();
          }),
      },
      'remove',
    )
    .name('Delete selected');
  presets
    .add(
      {
        exportFile: () => {
          const blob = new Blob([serializePreset(tuning, state.name)], {
            type: 'application/json',
          });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `${state.name}.json`;
          a.click();
          URL.revokeObjectURL(a.href);
          say(`exported ${state.name}.json`);
        },
      },
      'exportFile',
    )
    .name('Export file');
  presets
    .add(
      {
        importFile: () => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.json,application/json';
          input.onchange = () => {
            const file = input.files?.[0];
            if (!file) return;
            void file
              .text()
              .then((text) =>
                run(`imported ${file.name}`, () => applyPreset(tuning, parsePreset(text))),
              );
          };
          input.click();
        },
      },
      'importFile',
    )
    .name('Import file...');
  presets
    .add(
      {
        copy: () => {
          const patch = formatDefaultsPatch(diffFromDefaults(tuning, defaults));
          console.log(patch);
          void navigator.clipboard?.writeText(patch).then(
            () => say('copied: paste it to Claude to commit as defaults'),
            () => say('clipboard blocked: patch printed to the console'),
          );
        },
      },
      'copy',
    )
    .name('Copy as defaults');
  presets
    .add(
      {
        reset: () =>
          run('reset to defaults', () =>
            applyPreset(tuning, parsePreset(serializePreset(defaults, 'defaults'))),
          ),
      },
      'reset',
    )
    .name('Reset all to defaults');
  const statusController = presets.add(status, 'text').name('status').disable();
  rebuildSaved();

  folder('Debug').add(debug, 'overlay').name('overlay (`)');
  const replay = createReplayControls(folder('Replay'), world, refresh);

  const onKey = (e: KeyboardEvent): void => {
    if (e.code !== 'Backquote') return;
    debug.overlay = !debug.overlay;
    refresh();
  };
  window.addEventListener('keydown', onKey);

  return {
    debug,
    replay,
    dispose() {
      window.removeEventListener('keydown', onKey);
      gui.destroy();
    },
  };
}
