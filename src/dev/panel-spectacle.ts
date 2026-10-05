import type { ParamDef } from '../core/params/params';
import { activePresentation } from '../ui/spectacle/active';
import {
  applyPreset,
  INTENSITY_KEYS,
  LAYER_KEYS,
  matchingPreset,
  MAX_INTENSITY,
  PRESET_NAMES,
  spectacle,
  storeSettings,
  type IntensityKey,
  type LayerKey,
  type PresetName,
} from '../ui/spectacle/settings';
import {
  choiceRow,
  sliderRow,
  statusLine,
  type Row,
  type Section,
  type UiContext,
} from './panel-ui';

type Track = <T extends Row>(row: T, into: Section) => T;

const INTENSITY_NOTES: Record<IntensityKey, string> = {
  zoomPunch:
    'How hard the picture punches in on big kills, missile salvos and hits. 0 = never zooms; 1 = designed; higher = more violent. Drawing only.',
  roll: 'How much the view banks into your turns. 0 = level; 1 = about two degrees at the sharpest turn. Drawing only.',
  hitStop:
    'Tiny freezes of the picture on big kills and hits (the game keeps running underneath). 0 = none. Drawing only.',
  killCam:
    'The freeze frame with a speed-line flash after a missile salvo that kills several enemies. 0 = never.',
  shake: 'Extra screen shake on impacts, tuned per event (on top of the camera shake). 0 = none.',
  vignette:
    'The red tension vignette when your hull is low and the flash when you are hit. 0 = none.',
  speedFlash: 'The burst of speed lines on the kill-cam. 0 = none.',
};

const LAYER_NOTES: Record<LayerKey, string> = {
  hud: 'The anime HUD (angled panels, hull, salvo, roster). Off = the classic HUD text.',
  menus: 'The cinematic Start, debrief and end screens. Off = the classic menus.',
  portraits: 'Procedural visor portraits for pilots (roster, comm windows, menus).',
  comms: 'Radio chatter as comm windows with pilot name and callsign. Off = the plain text lines.',
  banners: 'Title cards and banners (BATTLE 2, WAVE 2/3, CLEARED, PILOT LOST).',
  feed: 'The kill feed and the score (UI only).',
  combo: 'The kill streak counter and its calls (UI only).',
  indicators: 'Off-screen arrows with distance, threats and the rescue pod beacon.',
  locks: 'Dramatic lock reticles and the rescue pod rings.',
};

/** The Spectacle section: the master switch, a preset picker, one switch per layer and one slider per motion effect. */
export function buildSpectacleSection(ctx: UiContext, section: Section, track: Track): () => void {
  const status = statusLine();
  const def = activePresentation();
  status.set(
    def
      ? 'The presentation of this style: HUD, menus and camera feel. Render and UI only; the simulation and replays are unchanged. Presets: full, calm, overdrive, off.'
      : 'This style has no presentation. Pick the anime-spectacle style (Look section) to use these.',
  );
  section.add(status);

  const rows: Row[] = [];
  const add = (row: Row): void => {
    rows.push(track(row, section));
  };
  const refresh = (): void => rows.forEach((r) => r.refresh());
  const changed = (): void => {
    storeSettings();
    refresh();
  };

  add(
    choiceRow<PresetName | 'custom'>(ctx, {
      id: 'spectacle.preset',
      label: 'Preset',
      note: 'full = the designed look; calm = the whole interface with almost no motion; overdrive = everything at 150%; off = the classic HUD and menus. Editing a slider switches to custom.',
      options: () => [...PRESET_NAMES],
      get: () => matchingPreset(spectacle),
      set: (v) => {
        if (v !== 'custom') applyPreset(v);
        changed();
      },
      format: (v) => v,
      trackChange: false,
    }),
  );
  add(
    choiceRow<boolean>(ctx, {
      id: 'spectacle.enabled',
      label: 'Spectacle',
      note: 'Master switch for the whole presentation layer. Off = the classic HUD, menus and no effects.',
      options: () => [true, false],
      get: () => spectacle.enabled,
      set: (v) => {
        spectacle.enabled = v;
        changed();
      },
      trackChange: false,
    }),
  );
  for (const key of LAYER_KEYS) {
    add(
      choiceRow<boolean>(ctx, {
        id: `spectacle.${key}`,
        label: key[0]!.toUpperCase() + key.slice(1),
        note: LAYER_NOTES[key],
        options: () => [true, false],
        get: () => spectacle[key],
        set: (v) => {
          spectacle[key] = v;
          changed();
        },
        trackChange: false,
      }),
    );
  }
  for (const key of INTENSITY_KEYS) {
    const pd: ParamDef = {
      default: 1,
      min: 0,
      max: MAX_INTENSITY,
      unit: 'x',
      step: 0.05,
      note: INTENSITY_NOTES[key],
    };
    add(
      sliderRow(ctx, {
        key,
        group: 'spectacle',
        def: pd,
        target: spectacle as unknown as Record<string, unknown>,
        label: key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()),
        trackChange: false,
        onChange: changed,
      }),
    );
  }
  return refresh;
}
