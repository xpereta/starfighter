import { createTuning, tuningParams, tuningToggleNotes, type Tuning } from '../../data/tuning';
import type { ParamDef } from '../core/params/params';
import type { World } from '../core/world/world';
import { labelOf } from './panel-logic';
import {
  applyPreset,
  diffFromDefaults,
  formatDefaultsPatch,
  parsePreset,
  presetToggles,
  RELOAD_ONLY,
  serializePreset,
  TUNED_GROUPS,
  type TunedGroup,
} from './presets';
import {
  blurActive,
  buttonRow,
  choiceRow,
  createPanelRoot,
  createTooltip,
  fieldRow,
  section,
  sliderRow,
  statusLine,
  type Row,
  type Section,
  type UiContext,
} from './panel-ui';
import { DEFAULT_PANEL_OPACITY, MIN_PANEL_OPACITY } from './panel-style';
import { activeStyle, activeWarnings, rememberStyle, styleIds } from '../render/style-active';
import { addLookRows } from './panel-look';
import { buildRunSpawnSections, type RunSpawnControls } from './panel-run';
import { buildSoundSection } from './panel-sound';
import { createReplayControls, type ReplayControls } from './replay-controls';

const PRESETS_KEY = 'starfighter.presets';
const OPACITY_KEY = 'starfighter.panel.opacity';

type Group = Record<string, number | string | boolean>;

function readStore(): Record<string, string> {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(PRESETS_KEY) ?? '{}');
    return typeof raw === 'object' && raw !== null ? (raw as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeStore(presets: Record<string, string>): void {
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  } catch {
    // Storage blocked: presets can still be exported to a file.
  }
}

function readOpacity(): number {
  try {
    const v = Number.parseFloat(localStorage.getItem(OPACITY_KEY) ?? '');
    if (Number.isFinite(v) && v >= MIN_PANEL_OPACITY && v <= 1) return v;
  } catch {
    // Ignore blocked storage.
  }
  return DEFAULT_PANEL_OPACITY;
}

const isTyping = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);

export interface Panel {
  /** Live readout in the Sound section (loop values and active loops); call about ten times a second. */
  readonly soundReadout: { update(world: World): void };
  readonly debug: { overlay: boolean };
  readonly replay: ReplayControls;
  /** Run phase and Spawn sections: readouts to refresh about ten times a second. */
  readonly devActions: RunSpawnControls;
  dispose(): void;
}

/**
 * Compact tuning panel: one line per parameter, the bar is a fill inside the row, plain-language
 * tooltips. Edits `world.tuning` in place. Ranges, units and notes come from data/tuning.
 */
export function createPanel(world: World): Panel {
  const tuning: Tuning = world.tuning;
  const defaults = createTuning();
  const root = createPanelRoot();
  const tip = createTooltip(root);
  const debug = { overlay: false };
  const ui = { changedOnly: false, opacity: readOpacity() };
  const allRows: Row[] = [];
  const paramSections: Section[] = [];

  const updateFilter = (): void => {
    for (const s of paramSections) {
      if (!ui.changedOnly) {
        s.rows.forEach((r) => (r.el.hidden = false));
        s.setHidden(false);
        continue;
      }
      let any = false;
      for (const r of s.rows) {
        r.el.hidden = !r.isChanged();
        any ||= r.isChanged();
      }
      s.setHidden(!any);
    }
  };
  const refresh = (): void => {
    allRows.forEach((r) => r.refresh());
    updateFilter();
  };
  const ctx: UiContext = { root, tip, changed: updateFilter };
  const track = <T extends Row>(row: T, into: Section): T => {
    into.add(row);
    allRows.push(row);
    return row;
  };

  // Header and global controls.
  const header = document.createElement('div');
  header.className = 'header';
  header.innerHTML =
    '<span>Tuning</span><small>H hides · G debug · N next battle · X clear</small>';
  root.append(header);

  const general = section('Panel', true);
  root.append(general.el);
  track(
    choiceRow<boolean>(ctx, {
      id: 'ui.changedOnly',
      label: 'Show only changed',
      note: 'Hides every setting that still has its default value, so you can see what you have tuned. Rows with a yellow bar on their left edge differ from the default.',
      options: () => [false, true],
      get: () => ui.changedOnly,
      set: (v) => (ui.changedOnly = v),
    }),
    general,
  );
  track(
    sliderRow(ctx, {
      key: 'opacity',
      group: 'ui',
      label: 'Panel opacity',
      def: {
        default: DEFAULT_PANEL_OPACITY,
        min: MIN_PANEL_OPACITY,
        max: 1,
        unit: '',
        step: 0.05,
        note: 'How see-through the panel is while you are not pointing at it. Higher = easier to read; lower = you see more of the game behind it. It becomes fully solid under the mouse.',
      },
      target: ui,
      trackChange: false,
      onChange: (v) => {
        root.style.setProperty('--panel-opacity', String(v));
        try {
          localStorage.setItem(OPACITY_KEY, String(v));
        } catch {
          // Ignore blocked storage.
        }
      },
    }),
    general,
  );
  root.style.setProperty('--panel-opacity', String(ui.opacity));

  // Tuning sections, generated from the parameter definitions.
  // Prototype 2 groups get a section of their own, created only once they have parameters.
  const groupSection: Partial<Record<TunedGroup, string>> = {
    lockon: 'Lock-on',
    missiles: 'Missiles',
    fighter: 'Enemy fighter',
    lancer: 'Missile fighter',
    squadron: 'Wingmen',
    arena: 'Arena',
    run: 'Run',
    pilots: 'Pilots',
    rescue: 'Rescue',
    chatter: 'Chatter',
    capital: 'Capital ship',
  };
  const names = [
    'Flight',
    'Evade',
    'Guns',
    'Camera',
    ...TUNED_GROUPS.flatMap((g) => {
      const n = groupSection[g];
      const visible = Object.keys(tuningParams[g]).filter((k) => !RELOAD_ONLY.has(k));
      const hasRows = visible.length + Object.keys(presetToggles(g)).length > 0;
      return n && hasRows ? [n] : [];
    }),
  ];
  const sections: Record<string, Section> = Object.fromEntries(
    names.map((n) => [n, section(n, n === 'Flight')]),
  );
  for (const n of names) {
    root.append(sections[n]!.el);
    paramSections.push(sections[n]!);
  }
  const sectionOf = (group: TunedGroup, key: string): Section => {
    const own = groupSection[group];
    if (own) return sections[own]!;
    if (group === 'weapons') return sections.Guns!;
    if (group === 'camera') return sections.Camera!;
    return key.startsWith('evade') ? sections.Evade! : sections.Flight!;
  };

  for (const group of TUNED_GROUPS) {
    const values = tuning[group] as unknown as Group;
    const defs: Record<string, ParamDef> = tuningParams[group];
    for (const [key, def] of Object.entries(defs)) {
      if (RELOAD_ONLY.has(key)) continue; // pool sizes only apply when the world is created
      track(sliderRow(ctx, { key, group, def, target: values }), sectionOf(group, key));
    }
  }
  for (const group of TUNED_GROUPS) {
    const values = tuning[group] as unknown as Group;
    const base = defaults[group] as unknown as Group;
    for (const [key, options] of Object.entries(presetToggles(group))) {
      track(
        choiceRow<string | boolean>(ctx, {
          id: `${group}.${key}`,
          label: labelOf(key),
          note: tuningToggleNotes[`${group}.${key}`] ?? '',
          options: () => options,
          get: () => values[key] as string | boolean,
          set: (v) => (values[key] = v),
          defaultValue: base[key] as string | boolean,
        }),
        sectionOf(group, key),
      );
    }
  }

  // Look and Sound: skeleton sections, the Look track and the Sound track fill them.
  const look = section('Look', false);
  const sound = section('Sound', false);
  root.append(look.el, sound.el);
  track(
    choiceRow<string>(ctx, {
      id: 'style.id',
      label: 'Style',
      note: 'The art direction (a style pack in data/styles). Click to cycle; the page reloads with ?style=<id> so the whole look and sound switch. Anything a pack misses falls back to plain.',
      options: styleIds,
      get: () => activeStyle().manifest.id,
      set: (id) => {
        rememberStyle(id);
        const url = new URL(window.location.href);
        url.searchParams.set('style', id);
        window.location.assign(url);
      },
      format: (id) => id,
      trackChange: false,
    }),
    look,
  );
  const styleStatus = statusLine();
  const warnings = activeWarnings();
  styleStatus.set(
    warnings.length
      ? warnings.join(' / ')
      : `${activeStyle().manifest.name}: ${activeStyle().manifest.intent}`,
  );
  look.add(styleStatus);
  const disposeLook = addLookRows(ctx, look, track);
  const soundReadout = buildSoundSection(ctx, sound, track, refresh);

  // Presets.
  const presets = section('Presets', false);
  root.append(presets.el);
  const presetState = { name: 'my-preset', saved: '' };
  const status = statusLine();
  const say = (text: string): void => status.set(text);
  const run = (label: string, fn: () => void): void => {
    try {
      fn();
      refresh();
      say(label);
    } catch (e) {
      say(`error: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  const savedNames = (): string[] => Object.keys(readStore());
  presetState.saved = savedNames()[0] ?? '';

  track(
    fieldRow(
      ctx,
      'Name',
      {
        get value() {
          return presetState.name;
        },
        set value(v: string) {
          presetState.name = v;
        },
      },
      'Name for the next saved or exported preset.',
    ),
    presets,
  );
  track(
    choiceRow<string>(ctx, {
      id: 'presets.selected',
      label: 'Selected',
      note: 'Click to cycle through the presets saved in this browser. Load or delete the one shown.',
      options: () => (savedNames().length ? savedNames() : ['']),
      get: () => presetState.saved,
      set: (v) => (presetState.saved = v),
      format: (v) => v || '(none saved)',
      trackChange: false,
    }),
    presets,
  );
  const act = (label: string, fn: () => void, note: string): void => {
    track(buttonRow(ctx, label, fn, note), presets);
  };
  act(
    'Save',
    () =>
      run(`saved "${presetState.name}"`, () => {
        writeStore({
          ...readStore(),
          [presetState.name]: serializePreset(tuning, presetState.name),
        });
        presetState.saved = presetState.name;
      }),
    'Saves every tuned value under the name above, in this browser.',
  );
  act(
    'Load selected',
    () =>
      run(`loaded "${presetState.saved}"`, () => {
        const text = readStore()[presetState.saved];
        if (!text) throw new Error('no preset selected');
        applyPreset(tuning, parsePreset(text));
      }),
    'Applies the selected preset to the game right now.',
  );
  act(
    'Delete selected',
    () =>
      run(`deleted "${presetState.saved}"`, () => {
        const all = readStore();
        delete all[presetState.saved];
        writeStore(all);
        presetState.saved = savedNames()[0] ?? '';
      }),
    'Removes the selected preset from this browser.',
  );
  act(
    'Export file',
    () => {
      const blob = new Blob([serializePreset(tuning, presetState.name)], {
        type: 'application/json',
      });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${presetState.name}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      say(`exported ${presetState.name}.json`);
    },
    'Downloads the current tuning as a JSON file you can share or keep.',
  );
  act(
    'Import file...',
    () => {
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
    'Loads a preset file. Bad or out-of-range files are rejected with a message.',
  );
  act(
    'Copy as defaults',
    () => {
      const patch = formatDefaultsPatch(diffFromDefaults(tuning, defaults));
      console.log(patch);
      void navigator.clipboard?.writeText(patch).then(
        () => say('copied: paste it to Claude to commit as defaults'),
        () => say('clipboard blocked: patch printed to the console'),
      );
    },
    'Copies a list of every value that differs from the committed defaults. Paste it to Claude to make them the new defaults.',
  );
  act(
    'Reset all to defaults',
    () =>
      run('reset to defaults', () =>
        applyPreset(tuning, parsePreset(serializePreset(defaults, 'defaults'))),
      ),
    'Puts every tuned value back to the committed default.',
  );
  presets.add(status);

  // Replay.
  const replaySection = section('Replay', false);
  root.append(replaySection.el);
  const replay = createReplayControls(
    { add: (row) => track(row, replaySection), status: (s) => replaySection.add(s) },
    ctx,
    world,
    refresh,
  );

  // Run phase and Spawn: world edits for testing (refused while a replay records or plays).
  const runSection = section('Run phase', false);
  const spawnSection = section('Spawn', false);
  root.append(runSection.el, spawnSection.el);
  const devActions = buildRunSpawnSections(
    ctx,
    { run: runSection, spawn: spawnSection },
    track,
    world,
    () => replay.busy(),
    refresh,
  );

  // Debug overlay toggle.
  const debugSection = section('Debug', false);
  root.append(debugSection.el);
  track(
    choiceRow<boolean>(ctx, {
      id: 'debug.overlay',
      label: 'Debug overlay (G)',
      note: 'Draws vectors, hit circles, the camera safe frame, the turn-rate curve and entity counts on top of the game.',
      options: () => [false, true],
      get: () => debug.overlay,
      set: (v) => (debug.overlay = v),
      trackChange: false,
    }),
    debugSection,
  );
  track(
    choiceRow<boolean>(ctx, {
      id: 'arena.enemiesFrozen',
      label: 'Freeze enemies',
      note: tuningToggleNotes['arena.enemiesFrozen'] ?? '',
      options: () => [false, true],
      get: () => tuning.arena.enemiesFrozen,
      set: (v) => (tuning.arena.enemiesFrozen = v),
      defaultValue: defaults.arena.enemiesFrozen,
    }),
    debugSection,
  );

  // A hint on the game screen that is still there when the panel is hidden.
  const hint = document.createElement('div');
  hint.className = 'dev-hint';
  hint.textContent = 'H show panel · G debug overlay · N next battle · X clear enemies';
  hint.hidden = !root.hidden;
  document.body.append(hint);

  const onKey = (e: KeyboardEvent): void => {
    if (e.code === 'Escape') {
      tip.hide();
      blurActive(); // hand the keyboard back to the game
      return;
    }
    if (isTyping(e.target)) return;
    if (e.code === 'KeyG') {
      debug.overlay = !debug.overlay;
      refresh();
    } else if (e.code === 'KeyN' && !e.repeat) {
      devActions.nextBattle();
    } else if (e.code === 'KeyX' && !e.repeat) {
      devActions.clearEnemies();
    } else if (e.code === 'KeyH') {
      root.hidden = !root.hidden;
      hint.hidden = !root.hidden;
      tip.hide();
    }
  };
  window.addEventListener('keydown', onKey);
  refresh();

  return {
    soundReadout,
    debug,
    replay,
    devActions,
    dispose() {
      window.removeEventListener('keydown', onKey);
      disposeLook();
      tip.dispose();
      root.remove();
      hint.remove();
    },
  };
}
