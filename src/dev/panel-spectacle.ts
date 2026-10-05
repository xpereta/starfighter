import { activeStyle } from '../render/style-active';
import {
  currentFxLevel,
  FX_LEVELS,
  setFxLevel,
  spectacleSettings,
} from '../render/spectacle/settings';
import { SPECTACLE_SLIDERS, sliderTarget } from './panel-spectacle-logic';
import {
  buttonRow,
  choiceRow,
  sliderRow,
  statusLine,
  type Row,
  type Section,
  type UiContext,
} from './panel-ui';

const SWITCHES: readonly {
  key: 'post' | 'bloom' | 'backdrop' | 'ships' | 'combat' | 'cards';
  label: string;
  note: string;
}[] = [
  {
    key: 'post',
    label: 'Post-processing',
    note: 'Master switch of the finishing passes: bloom, colour fringe, vignette, grain, scanlines, zoom punch. Off = the plain scene.',
  },
  { key: 'bloom', label: 'Bloom', note: 'The glow on bright things only.' },
  {
    key: 'backdrop',
    label: 'Living backdrop',
    note: 'Gas clouds, far structures, drifting rocks, distant flashes and the extra star layers.',
  },
  {
    key: 'ships',
    label: 'Ship effects',
    note: 'Engine plumes, nav lights, trails, roll streaks, missile spirals and lock brackets.',
  },
  {
    key: 'combat',
    label: 'Combat effects',
    note: 'Multi-stage explosions, sparks, ink-blots, tracers, chain reactions.',
  },
  {
    key: 'cards',
    label: 'Title cards',
    note: 'Battle intro and outro cards, pilot-lost and victory flourishes.',
  },
];

/**
 * Fills the Spectacle section: quality level (also `?fx=`), a switch per effect group, the overall
 * strength and a slider for each number of the pack's spectacle. Edits change the resolved pack in
 * memory only, like the Look section.
 */
export function addSpectacleRows(
  ctx: UiContext,
  sec: Section,
  track: <T extends Row>(row: T, into: Section) => T,
): void {
  const say = statusLine();
  const spec = activeStyle().spectacle;
  say.set(
    spec
      ? `${activeStyle().manifest.name}: spectacle on. Quality ${currentFxLevel()} (?fx=low|medium|high).`
      : 'This style has no spectacle: pick anime-spectacle in the Style row above.',
  );
  sec.add(say);

  sec.add(
    buttonRow(
      ctx,
      'Demo blasts',
      () => (globalThis as { __sfDemo?: () => void }).__sfDemo?.(),
      'Sets off one kill of each kind (turret, fighter, drone, static target, wingman), a missile impact and some hits ahead of you, in the active style. Only the picture: nothing in the game changes.',
    ),
  );
  track(
    choiceRow<string>(ctx, {
      id: 'spectacle.quality',
      label: 'Quality',
      note: 'low = no post-processing, no shader clouds, small pools (the fallback for weak devices); medium; high. Also ?fx=low|medium|high in the URL. Remembered in this browser.',
      options: () => [...FX_LEVELS],
      get: () => currentFxLevel(),
      set: (v) => setFxLevel(v as (typeof FX_LEVELS)[number], true),
      format: (v) => v,
      trackChange: false,
    }),
    sec,
  );
  track(
    choiceRow<number>(ctx, {
      id: 'spectacle.sky',
      label: 'Sky palette',
      note: "Which battle's sky to show: auto follows the run (the first sky in practice mode); 1 to 4 preview each palette. Also ?sky=2 in the URL.",
      options: () => [0, 1, 2, 3, 4],
      get: () => spectacleSettings.sky,
      set: (v) => (spectacleSettings.sky = v),
      format: (v) => (v === 0 ? 'auto' : `battle ${v}`),
      trackChange: false,
    }),
    sec,
  );
  for (const s of SWITCHES)
    track(
      choiceRow<boolean>(ctx, {
        id: `spectacle.${s.key}`,
        label: s.label,
        note: s.note,
        options: () => [false, true],
        get: () => spectacleSettings[s.key],
        set: (v) => (spectacleSettings[s.key] = v),
        defaultValue: true,
      }),
      sec,
    );
  track(
    sliderRow(ctx, {
      key: 'intensity',
      group: 'spectacle',
      label: 'Intensity',
      def: {
        default: 1,
        min: 0,
        max: 1,
        unit: '',
        step: 0.05,
        note: 'Overall strength of the flashes, zoom punch and colour-fringe pulses. 0 = steady picture.',
      },
      target: spectacleSettings as unknown as Record<string, unknown>,
    }),
    sec,
  );
  if (!spec) return;
  for (const s of SPECTACLE_SLIDERS) {
    const target = sliderTarget(spec, s);
    if (!target) continue;
    track(
      sliderRow(ctx, {
        key: s.key,
        group: `spectacle.${s.section}${s.path ? `.${s.path}` : ''}`,
        label: s.label,
        def: { ...s.def, default: target[s.key] as number },
        target,
      }),
      sec,
    );
  }
}
