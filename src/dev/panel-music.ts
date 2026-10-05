import { activeAudio } from '../audio';
import type { MusicStatus } from '../audio/conductor';
import type { Scene, ScoreDef, Stem } from '../audio/score';
import { SCENES } from '../audio/score';
import type { ParamDef } from '../core/params/params';
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
import { formatMusicStatus, formatStems } from './panel-music-logic';

type Track = <T extends Row>(row: T, into: Section) => T;

const SCENE_LABEL: Record<Scene, string> = {
  menu: 'Start screen',
  flight: 'Flying',
  debrief: 'Debrief',
  end: 'End screen',
};

const TEMPO: ParamDef & { step: number } = {
  default: 124,
  min: 60,
  max: 200,
  step: 1,
  unit: 'bpm',
  note: 'Tempo of the whole score. Changes take effect from the next bar and keep every cue and stinger in time. Faster = more urgent.',
};
const SCORE_VOLUME: ParamDef & { step: number } = {
  default: 0.55,
  min: 0,
  max: 1,
  step: 0.01,
  unit: '',
  note: 'Level of the whole score before the Music volume in the mix. Lower it to let the sound effects lead; higher for a more cinematic mix.',
};
const FORCED_INTENSITY: ParamDef & { step: number } = {
  default: 0.5,
  min: 0,
  max: 1,
  step: 0.01,
  unit: '',
  note: 'The fight intensity the score plays while "Force intensity" is on: 0 = calm patrol, about 0.4 = fighters appear (hats, bass, arpeggio), about 0.6 = a fight (kick, drive bass), 0.8 = full battle (brass, hero theme), 1 = everything.',
};
const STEM_VOLUME: ParamDef & { step: number } = {
  default: 0.6,
  min: 0,
  max: 1,
  step: 0.01,
  unit: '',
  note: 'Loudness of this one layer of the score (it still fades in and out with its gate). 0 mutes it.',
};
const STEM_ON: ParamDef & { step: number } = {
  default: 0.5,
  min: 0,
  max: 1,
  step: 0.01,
  unit: '',
  note: 'The game value (intensity, rescue or danger, see the stem) at which this layer starts to fade in. Lower = it joins earlier.',
};
const STEM_FULL: ParamDef & { step: number } = {
  default: 0.7,
  min: 0,
  max: 1,
  step: 0.01,
  unit: '',
  note: 'The value at which this layer is fully in. The distance from "on" is how gradually it arrives.',
};

/**
 * The adaptive score's rows in the Sound section: a live readout (scene, cue, bar, intensity,
 * stems), a forced scene and intensity to hear the music without playing, tempo and volume, one
 * chosen stem's volume and gate, and a stinger test. The rows edit the active style's score in
 * place (Save style keeps nothing of it: copy the numbers into `data/styles/<id>/music.ts`).
 */
export function buildMusicRows(
  ctx: UiContext,
  sound: Section,
  track: Track,
  refreshAll: () => void,
): { update(): void } | null {
  const audio = activeAudio();
  if (!audio) return null;
  const { engine } = audio;
  const score = (): ScoreDef | null => {
    const m = activeStyle().music;
    return m && m.source.kind === 'score' ? m.source.score : null;
  };
  const status = statusLine();
  const stems = statusLine();
  status.el.dataset.musicStatus = '';
  stems.el.dataset.musicStems = '';
  sound.add(status);
  sound.add(stems);

  const forced: { scene: Scene | 'game'; useIntensity: boolean; intensity: number } = {
    scene: 'game',
    useIntensity: false,
    intensity: FORCED_INTENSITY.default,
  };
  const applyForce = (): void => {
    engine.forceMusic(
      forced.scene === 'game' && !forced.useIntensity
        ? null
        : {
            ...(forced.scene === 'game' ? {} : { scene: forced.scene }),
            ...(forced.useIntensity ? { intensity: forced.intensity } : {}),
          },
    );
  };
  track(
    choiceRow<Scene | 'game'>(ctx, {
      id: 'music.scene',
      label: 'Music scene',
      note: 'Which part of the game the music plays: "game" follows what is happening; the others lock it to the Start screen, flying, the debrief or the end screen so you can hear each cue without playing. The first click also starts the audio.',
      options: () => ['game', ...SCENES],
      get: () => forced.scene,
      set: (v) => {
        forced.scene = v;
        engine.unlock();
        applyForce();
      },
      format: (v) => (v === 'game' ? 'game (follow play)' : SCENE_LABEL[v]),
      trackChange: false,
    }),
    sound,
  );
  track(
    choiceRow<boolean>(ctx, {
      id: 'music.forceIntensity',
      label: 'Force intensity',
      note: 'Plays the score at the intensity below instead of the one computed from the fight (enemies alive, hull, recent hits). Turn it off to hear the real game again.',
      options: () => [false, true],
      get: () => forced.useIntensity,
      set: (v) => {
        forced.useIntensity = v;
        engine.unlock();
        applyForce();
      },
      defaultValue: false,
      trackChange: false,
    }),
    sound,
  );
  track(
    sliderRow(ctx, {
      key: 'intensity',
      group: 'music',
      def: FORCED_INTENSITY,
      target: forced,
      label: 'Forced intensity',
      trackChange: false,
      onChange: () => applyForce(),
    }),
    sound,
  );

  const tempoTarget: Record<string, unknown> = {};
  Object.defineProperty(tempoTarget, 'bpm', {
    enumerable: true,
    get: () => score()?.bpm ?? TEMPO.default,
    set: (v: number) => {
      const s = score();
      if (s) s.bpm = v;
    },
  });
  track(
    sliderRow(ctx, {
      key: 'bpm',
      group: 'music',
      def: TEMPO,
      target: tempoTarget,
      label: 'Score tempo',
      trackChange: false,
    }),
    sound,
  );
  const volumeTarget: Record<string, unknown> = {};
  Object.defineProperty(volumeTarget, 'volume', {
    enumerable: true,
    get: () => activeStyle().music?.volume ?? SCORE_VOLUME.default,
    set: (v: number) => {
      const m = activeStyle().music;
      if (m) m.volume = v;
    },
  });
  track(
    sliderRow(ctx, {
      key: 'volume',
      group: 'music',
      def: SCORE_VOLUME,
      target: volumeTarget,
      label: 'Score level',
      trackChange: false,
    }),
    sound,
  );

  // One chosen stem: its volume and the window of the game value in which it fades in.
  const stemList = (): Stem[] => {
    const cues = score()?.cues;
    if (!cues) return [];
    const seen = new Set<string>();
    const out: Stem[] = [];
    for (const cue of Object.values(cues))
      for (const s of cue.stems)
        if (!seen.has(s.id)) {
          seen.add(s.id);
          out.push(s);
        }
    return out;
  };
  let selected = '';
  const chosen = (): Stem | null =>
    stemList().find((s) => s.id === selected) ?? stemList()[0] ?? null;
  const stemTarget: Record<string, unknown> = {};
  const edit = (
    k: 'volume' | 'on' | 'full',
    read: (s: Stem) => number,
    write: (s: Stem, v: number) => void,
    d: number,
  ): void => {
    Object.defineProperty(stemTarget, k, {
      enumerable: true,
      get: () => {
        const s = chosen();
        return s ? read(s) : d;
      },
      set: (v: number) => {
        // The same stem id in several cues (the menu reuses the battle's pad) changes together.
        for (const cue of Object.values(score()?.cues ?? {}))
          for (const s of cue.stems) if (s.id === chosen()?.id) write(s, v);
      },
    });
  };
  edit(
    'volume',
    (s) => s.volume,
    (s, v) => void ((s as { volume: number }).volume = v),
    STEM_VOLUME.default,
  );
  edit(
    'on',
    (s) => s.gate.on,
    (s, v) => void ((s.gate as { on: number }).on = v),
    STEM_ON.default,
  );
  edit(
    'full',
    (s) => s.gate.full,
    (s, v) => void ((s.gate as { full: number }).full = v),
    STEM_FULL.default,
  );
  track(
    choiceRow<string>(ctx, {
      id: 'music.stem',
      label: 'Edit stem',
      note: 'Which layer of the score the rows below change (pad, bassCalm, horn, arpCalm, hats, kick, bassDrive, snare, brass, lead, rescueBells, heartbeat ...). Click for the next one.',
      options: () => stemList().map((s) => s.id),
      get: () => chosen()?.id ?? '',
      set: (id) => {
        selected = id;
        refreshAll();
      },
      trackChange: false,
    }),
    sound,
  );
  for (const [key, def, label] of [
    ['volume', STEM_VOLUME, 'Stem volume'],
    ['on', STEM_ON, 'Stem fades in at'],
    ['full', STEM_FULL, 'Stem full at'],
  ] as const) {
    track(
      sliderRow(ctx, {
        key,
        group: 'musicStem',
        def,
        target: stemTarget,
        label,
        trackChange: false,
      }),
      sound,
    );
  }

  // Stingers: pick one and play it (on the beat grid, like the game does).
  let sting = '';
  const stingKeys = (): string[] => Object.keys(score()?.stingers ?? {});
  track(
    choiceRow<string>(ctx, {
      id: 'music.stinger',
      label: 'Stinger',
      note: 'Which short phrase the next button plays (battleStart, waveStart, threat, victory, finale, defeat, pilotLost, rescued, beacon, wingmanDown, welcome). The game plays them from events: battle start, wave start, a battle won, the run won or lost, a pilot lost, a rescue.',
      options: () => stingKeys(),
      get: () => (stingKeys().includes(sting) ? sting : (stingKeys()[0] ?? '')),
      set: (k) => {
        sting = k;
      },
      trackChange: false,
    }),
    sound,
  );
  track(
    buttonRow(
      ctx,
      '▶ Play the stinger',
      () => {
        const k = stingKeys().includes(sting) ? sting : stingKeys()[0];
        if (k) engine.playStinger(k);
      },
      'Plays the chosen stinger on the next beat. Stingers dip or cut the music while they play, and a higher-priority one replaces a lower one. The first click also starts the audio.',
    ),
    sound,
  );

  return {
    update() {
      const s: MusicStatus | null = engine.musicStatus;
      const has = score() !== null;
      if (!has) {
        status.set('Music: this style has no adaptive score (a simple loop or none).');
        stems.set('');
        return;
      }
      if (!engine.unlocked || !s) {
        status.set('Music: starts after the first key press.');
        stems.set('');
        return;
      }
      status.set(formatMusicStatus(s));
      stems.set(formatStems(s.stems));
    },
  };
}
