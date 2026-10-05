import { mixParams } from '../../data/audio/mix';
import { activeAudio } from '../audio';
import { loopStateOf } from '../audio/state';
import type { World } from '../core/world/world';
import { formatLoopsActive, formatLoopValues } from './panel-sound-logic';
import type { ParamDef } from '../core/params/params';
import {
  LOOP_KEYS,
  SOUND_EVENT_KEYS,
  type LoopEntry,
  type LoopKey,
  type SoundEntry,
  type SoundEventKey,
} from '../render/style';
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
  reverb: {
    default: 0,
    min: 0,
    max: 1,
    unit: '',
    step: 0.01,
    note: 'How much of this sound goes to the shared space reverb (the tail). 0 = dry; 1 = the tail is as loud as the sound. Explosions and radio like more; clicks and tones less.',
  },
  preDelay: {
    default: 0,
    min: 0,
    max: 0.5,
    unit: 's',
    step: 0.005,
    note: 'Gap between the sound and the start of its reverb. Longer = a bigger space, and the sound stays clear before the tail arrives. Only matters when the reverb send is above 0.',
  },
} as const satisfies Record<string, ParamDef>;

/** The values of one loop the panel edits live. */
const LOOP_PARAMS = {
  volume: {
    default: 0.2,
    min: 0,
    max: 1,
    unit: '',
    step: 0.01,
    note: 'Loudness of this continuous sound when its game value asks for full level. 0 = silent. Edits the active style live (Save style keeps it).',
  },
  fadeIn: {
    default: 0.4,
    min: 0.01,
    max: 5,
    unit: 's',
    step: 0.01,
    note: 'How long the loop takes to come up when its game value rises (smooth, no click). Short = reacts at once; long = swells in.',
  },
  fadeOut: {
    default: 0.6,
    min: 0.01,
    max: 5,
    unit: 's',
    step: 0.01,
    note: 'How long the loop takes to die away when its game value falls.',
  },
  reverb: {
    default: 0,
    min: 0,
    max: 1,
    unit: '',
    step: 0.01,
    note: 'How much of this loop goes to the shared space reverb. 0 = dry.',
  },
} as const satisfies Record<string, ParamDef>;
type LoopEditKey = keyof typeof LOOP_PARAMS;

const PREVIEW_PARAM = {
  default: 0.6,
  min: 0,
  max: 1,
  unit: '',
  step: 0.01,
  note: 'The game value the previewed loop follows (speed, throttle, hull, rescue progress... whatever its Gain curve uses). For on/off values (edge, always) anything from 0.5 up is on; for the hull it is damage (1 = nearly destroyed, which sounds the alarm).',
} as const satisfies ParamDef;
/** Smallest time between two previews while a slider is dragged (ms). */
const PREVIEW_GAP_MS = 200;
type EditKey = keyof typeof SOUND_PARAMS;
const EDIT_LABELS: Partial<Record<EditKey, string>> = {
  pitchRandom: 'Pitch spread',
  minGap: 'Min gap',
  reverb: 'Reverb send',
  preDelay: 'Reverb pre-delay',
};
const MIX_LABELS: Record<keyof typeof mixParams, string> = {
  master: 'Master volume',
  effects: 'Effects volume',
  music: 'Music volume',
  reverb: 'Reverb level',
  reverbTime: 'Reverb length',
};

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
): SoundReadout {
  const audio = activeAudio();
  const status = statusLine();
  sound.add(status);
  // The live readout: the values the loops follow and which loops are on. Updated while the panel is open.
  const valuesLine = statusLine();
  const loopsLine = statusLine();
  sound.add(valuesLine);
  sound.add(loopsLine);
  valuesLine.el.dataset.loopValues = '';
  loopsLine.el.dataset.loopsActive = '';
  const readout: SoundReadout = {
    update(world) {
      const a = activeAudio();
      if (!a) return;
      if (!a.engine.unlocked) {
        valuesLine.set(`${formatLoopValues(loopStateOf(world))} (audio starts after a key press)`);
        loopsLine.set('loops: not running yet');
        return;
      }
      const { state, frames } = a.engine.loopStatus;
      valuesLine.set(formatLoopValues(state));
      loopsLine.set(formatLoopsActive(frames, activeStyle().loops));
    },
  };
  if (!audio) {
    status.set('Sound is not running.');
    return readout;
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
        label: MIX_LABELS[key],
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
      note: 'Which sound the rows below change. Click to go to the next one. Silent sounds (marked "-") have nothing to edit.',
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
        label: EDIT_LABELS[key],
        trackChange: false,
        onChange: () => previewSelected(),
      }),
      sound,
    );
  }

  // Loops: the continuous sounds that follow the game state.
  let loopSelected: LoopKey = LOOP_KEYS.find((k) => style.loops[k] !== 'silent') ?? 'engine';
  const loopEntry = (): LoopEntry | null => {
    const e = activeStyle().loops[loopSelected];
    return e === 'silent' || e === undefined ? null : e;
  };
  const loopTarget: Record<string, unknown> = {};
  for (const k of Object.keys(LOOP_PARAMS) as LoopEditKey[]) {
    Object.defineProperty(loopTarget, k, {
      enumerable: true,
      get: () => loopEntry()?.[k] ?? LOOP_PARAMS[k].default,
      set: (v: number) => {
        const e = loopEntry();
        if (e) e[k] = v;
      },
    });
  }
  track(
    choiceRow<LoopKey>(ctx, {
      id: 'sound.loop',
      label: 'Edit loop',
      note: 'Which continuous sound (engine hum, afterburner, rumble, ambient bed, missile hiss, rescue tone, hull alarm, arena-edge alarm) the rows below change. Click for the next one. Silent loops (marked "-") have nothing to edit.',
      options: () => LOOP_KEYS,
      get: () => loopSelected,
      set: (k) => {
        loopSelected = k;
        if (previewState.on) applyPreview(); // the preview follows the chosen loop
        refreshAll();
      },
      format: (k) => (activeStyle().loops[k] === 'silent' ? `${k} -` : k),
      trackChange: false,
    }),
    sound,
  );
  for (const key of Object.keys(LOOP_PARAMS) as LoopEditKey[]) {
    track(
      sliderRow(ctx, {
        key,
        group: 'loopEdit',
        def: LOOP_PARAMS[key],
        target: loopTarget,
        label:
          key === 'fadeIn' ? 'Loop fade in' : key === 'fadeOut' ? 'Loop fade out' : `Loop ${key}`,
        trackChange: false,
      }),
      sound,
    );
  }
  const previewState = { on: false, value: PREVIEW_PARAM.default };
  const applyPreview = (): void =>
    engine.previewLoop(previewState.on ? loopSelected : null, previewState.value);
  track(
    choiceRow<boolean>(ctx, {
      id: 'sound.loopPreview',
      label: 'Preview the loop',
      note: 'Plays the chosen loop as if the game were at the value below (instead of the real game state), so you can hear it without flying. Turn it off to hear the real game again. The first click also starts the audio.',
      options: () => [false, true],
      get: () => previewState.on,
      set: (v) => {
        previewState.on = v;
        if (v) engine.unlock();
        applyPreview();
      },
      defaultValue: false,
      trackChange: false,
    }),
    sound,
  );
  track(
    sliderRow(ctx, {
      key: 'value',
      group: 'loopPreview',
      def: PREVIEW_PARAM,
      target: previewState,
      label: 'Preview value',
      trackChange: false,
      onChange: () => applyPreview(),
    }),
    sound,
  );

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
  return readout;
}

/** What the panel calls every frame (throttled by the caller) to keep the loop readout live. */
export interface SoundReadout {
  update(world: World): void;
}
