import { mixParams } from '../../data/audio/mix';
import { activeAudio } from '../audio';
import type { ParamDef } from '../core/params/params';
import { SOUND_EVENT_KEYS, type SoundEntry, type SoundEventKey } from '../render/style';
import { activeStyle } from '../render/style-active';
import {
  buttonRow,
  choiceRow,
  sliderRow,
  statusLine,
  type Row,
  type Section,
  type UiContext,
} from './panel-ui';

/** The per-sound values the panel edits live (the ranges match the style contract's validation). */
const SOUND_PARAMS = {
  volume: {
    default: 0.4,
    min: 0,
    max: 1,
    unit: '',
    step: 0.01,
    note: 'Loudness of this one sound before the mix. Higher = louder against the other sounds; 0 = silent. Edits the active style live (Save style keeps them).',
  },
  pitch: {
    default: 1,
    min: 0.1,
    max: 4,
    unit: 'x',
    step: 0.01,
    note: 'Base pitch of this sound. 1 = as designed; 2 = an octave higher (and the sweep runs the same time); 0.5 = an octave lower.',
  },
  pitchRandom: {
    default: 0.06,
    min: 0,
    max: 1,
    unit: '',
    step: 0.01,
    note: 'How much the pitch varies from play to play, as a fraction of the base pitch (0.1 = plus or minus 10%). 0 = the same note every time; higher = less repetitive, but too much sounds out of tune.',
  },
  minGap: {
    default: 0.05,
    min: 0,
    max: 2,
    unit: 's',
    step: 0.01,
    note: 'Smallest time between two plays of this sound. Higher = a busy fight triggers it less often (calmer, less machine-gun); 0 = every event sounds.',
  },
} as const satisfies Record<string, ParamDef>;
/** Smallest time between two previews while a slider is dragged (ms). */
const PREVIEW_GAP_MS = 200;
type EditKey = keyof typeof SOUND_PARAMS;

type Track = <T extends Row>(row: T, into: Section) => T;

/**
 * The Sound section of the panel: the mix (master, effects, music, mute), the volume and pitch of
 * one chosen sound, and a sound-test list that plays each sound. Edits the active style pack live.
 */
export function buildSoundSection(
  ctx: UiContext,
  sound: Section,
  track: Track,
  refreshAll: () => void,
): void {
  const audio = activeAudio();
  const status = statusLine();
  sound.add(status);
  if (!audio) {
    status.set('Sound is not running.');
    return;
  }
  const { engine, mix } = audio;
  const style = activeStyle();
  const silent = SOUND_EVENT_KEYS.filter((k) => style.sounds[k] === 'silent').length;
  status.set(
    `${style.manifest.name}: ${SOUND_EVENT_KEYS.length - silent} sounds, ${silent} silent. ` +
      (style.music ? 'Has a music track.' : 'No music track.') +
      ' Sound starts after the first key press. M mutes.',
  );

  for (const key of Object.keys(mixParams) as (keyof typeof mixParams)[]) {
    track(
      sliderRow(ctx, {
        key,
        group: 'sound',
        def: mixParams[key],
        target: mix,
        label:
          key === 'master'
            ? 'Master volume'
            : key === 'effects'
              ? 'Effects volume'
              : 'Music volume',
        onChange: () => engine.update(),
      }),
      sound,
    );
  }
  track(
    choiceRow<boolean>(ctx, {
      id: 'sound.mute',
      label: 'Mute (M)',
      note: 'Silences everything without touching the volumes. The M key does the same and is remembered in this browser.',
      options: () => [false, true],
      get: () => engine.muted,
      set: (v) => audio.setMuted(v),
      defaultValue: false,
    }),
    sound,
  );

  // One chosen sound: its volume and pitch.
  let selected: SoundEventKey = SOUND_EVENT_KEYS.find((k) => style.sounds[k] !== 'silent') ?? 'Hit';
  const entry = (): SoundEntry | null => {
    const e = activeStyle().sounds[selected];
    return e === 'silent' || e === undefined ? null : e;
  };
  const target: Record<string, unknown> = {};
  for (const k of Object.keys(SOUND_PARAMS) as EditKey[]) {
    Object.defineProperty(target, k, {
      enumerable: true,
      get: () => entry()?.[k] ?? SOUND_PARAMS[k].default,
      set: (v: number) => {
        const e = entry();
        if (e) e[k] = v;
      },
    });
  }
  track(
    choiceRow<SoundEventKey>(ctx, {
      id: 'sound.edit',
      label: 'Edit sound',
      note: 'Which sound the four rows below change. Click to go to the next one. Silent sounds (marked "-") have nothing to edit.',
      options: () => SOUND_EVENT_KEYS,
      get: () => selected,
      set: (k) => {
        selected = k;
        refreshAll();
      },
      format: (k) => (activeStyle().sounds[k] === 'silent' ? `${k} -` : k),
      trackChange: false,
    }),
    sound,
  );
  // Hear the change while dragging, but not on every pixel.
  let lastPreview = 0;
  const previewSelected = (): void => {
    const now = performance.now();
    if (now - lastPreview < PREVIEW_GAP_MS) return;
    lastPreview = now;
    engine.playTest(selected);
  };
  for (const key of Object.keys(SOUND_PARAMS) as EditKey[]) {
    track(
      sliderRow(ctx, {
        key,
        group: 'soundEdit',
        def: SOUND_PARAMS[key],
        target,
        label: key === 'pitchRandom' ? 'Pitch spread' : key === 'minGap' ? 'Min gap' : undefined,
        trackChange: false,
        onChange: () => previewSelected(),
      }),
      sound,
    );
  }

  // Sound test: every sound, one click each.
  track(
    buttonRow(
      ctx,
      '▶ Play the chosen sound',
      () => engine.playTest(selected),
      'Plays the sound chosen in "Edit sound" right now, as if its event had just happened.',
    ),
    sound,
  );
  for (const key of SOUND_EVENT_KEYS) {
    const row = track(
      buttonRow(
        ctx,
        `▶ ${key}`,
        () => engine.playTest(key),
        'Sound test: plays this sound now, as if its event had just happened. The first click also starts the audio.',
      ),
      sound,
    );
    row.el.dataset.soundTest = key;
  }
  track(
    buttonRow(
      ctx,
      '▶ Restart music',
      () => engine.refreshMusic(),
      "Restarts the style's music loop from the beginning (if the style has one). Its volume is the Music volume row; it dips while big explosions and radio sounds play.",
    ),
    sound,
  );
}
