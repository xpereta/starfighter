import { describe, expect, it } from 'vitest';
import { plain } from '../../data/styles/plain';
import { completeFallback } from './style-active';
import {
  checkStyle,
  missingParts,
  PALETTE_KEYS,
  resolveStyle,
  silentSoundTable,
  SOUND_EVENT_KEYS,
  type DeathDef,
  type ExplosionDef,
  type SoundEntry,
  type StyleInput,
  type StyleManifest,
} from './style';

const manifest: StyleManifest = {
  id: 'test-pack',
  name: 'Test pack',
  intent: 'A pack for tests.',
  parent: null,
  references: [{ title: 'Some anime', took: 'the outlines' }],
  status: 'idea',
  notes: '',
};
const good = (over: Partial<StyleInput> = {}): StyleInput => ({ manifest, ...over });
const triangle = [
  [0, 0],
  [1, 0],
  [0, 1],
] as const;
const blast: ExplosionDef = {
  size: 40,
  duration: 0.5,
  ramp: [0xffffff, 0xff8800],
  layers: 2,
  ring: 0.5,
  puffs: 2,
  spikes: 0,
  cross: 0,
  flashFrames: 0,
};
const death: DeathDef = {
  pieces: [3, 5],
  primary: { kind: 'small', size: 2 },
  secondary: [
    {
      kind: 'small',
      count: [1, 2],
      size: [0.5, 1],
      delay: [0.1, 1],
      attach: 'piece',
      consume: 0.5,
      chain: 0.3,
    },
  ],
  debris: { life: [1, 2], drift: [50, 100], spin: 4, fade: 0.5, trail: 2 },
  blow: 0.5,
  momentum: 0.5,
  hitStop: 0.05,
};
const beep: SoundEntry = {
  source: { kind: 'synth', waveform: 'sine' },
  pitch: 1,
  pitchRandom: 0.1,
  volume: 0.5,
  minGap: 0.05,
  maxVoices: 4,
};

describe('style validation', () => {
  it('accepts a good pack, and a manifest-only pack', () => {
    expect(checkStyle(plain)).toEqual([]);
    expect(checkStyle(good())).toEqual([]);
    expect(
      checkStyle(
        good({
          theme: { palette: { enemy: 0xff0000 }, glow: 0.5 },
          ships: { player: { polygon: triangle } },
          deaths: { fighter: death },
          explosions: { small: blast },
          sounds: { ShotFired: beep, Hit: 'silent' },
        }),
      ),
    ).toEqual([]);
  });

  it.each<[string, StyleInput, string]>([
    ['bad id', good({ manifest: { ...manifest, id: 'Bad Id' } }), 'manifest.id'],
    ['empty intent', good({ manifest: { ...manifest, intent: ' ' } }), 'manifest.intent'],
    ['unknown status', good({ manifest: { ...manifest, status: 'done' as 'idea' } }), 'status'],
    ['own parent', good({ manifest: { ...manifest, parent: 'test-pack' } }), 'parent'],
    [
      'reference without text',
      good({ manifest: { ...manifest, references: [{ title: '', took: 'x' }] } }),
      'references[0]',
    ],
    ['colour out of range', good({ theme: { palette: { enemy: 0x1000000 } } }), 'palette.enemy'],
    ['unknown palette key', good({ theme: { palette: { nope: 1 } as never } }), 'palette.nope'],
    ['outline too wide', good({ theme: { outlineWidth: 99 } }), 'outlineWidth'],
    ['shadow share above 1', good({ theme: { shadowShare: 2 } }), 'shadowShare'],
    ['unknown ship kind', good({ ships: { boat: { polygon: triangle } } as never }), 'ships.boat'],
    [
      'polygon too short',
      good({
        ships: {
          player: {
            polygon: [
              [0, 0],
              [1, 1],
            ],
          },
        },
      }),
      'at least 3',
    ],
    [
      'polygon not closed implicitly (repeats first point)',
      good({
        ships: {
          player: {
            polygon: [
              [0, 0],
              [10, 0],
              [0, 10],
              [0, 0],
            ],
          },
        },
      }),
      'closed implicitly',
    ],
    [
      'polygon unbounded',
      good({
        ships: {
          player: {
            polygon: [
              [0, 0],
              [10000, 0],
              [0, 10],
            ],
          },
        },
      }),
      'ships.player.polygon[1]',
    ],
    [
      'zero pieces',
      good({ deaths: { fighter: { ...death, pieces: [0, 2] } } }),
      'deaths.fighter.pieces',
    ],
    [
      'too many blasts',
      good({
        deaths: {
          fighter: {
            ...death,
            secondary: [
              { ...death.secondary[0]!, count: [10, 20] },
              { ...death.secondary[0]!, count: [10, 10] },
            ],
          },
        },
      }),
      'blasts in total',
    ],
    [
      'a delay beyond the limit',
      good({
        deaths: {
          fighter: { ...death, secondary: [{ ...death.secondary[0]!, delay: [0, 99] }] },
        },
      }),
      'secondary[0].delay',
    ],
    [
      'explosion without duration',
      good({ explosions: { small: { ...blast, duration: 0 } } }),
      'explosions.small.duration',
    ],
    ['unknown event', good({ sounds: { Boom: 'silent' } as never }), 'sounds.Boom'],
    ['bad volume', good({ sounds: { Hit: { ...beep, volume: 3 } } }), 'sounds.Hit.volume'],
    ['bad voices', good({ sounds: { Hit: { ...beep, maxVoices: 0 } } }), 'sounds.Hit.maxVoices'],
    [
      'sample without file',
      good({ sounds: { Hit: { ...beep, source: { kind: 'sample', file: '' } } } }),
      'source.file',
    ],
  ])('rejects %s', (_name, pack, fragment) => {
    const errors = checkStyle(pack);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join('\n')).toContain(fragment);
  });
});

describe('sound table', () => {
  it('has an entry for every event type and the table type is complete', () => {
    const table = silentSoundTable();
    expect(Object.keys(table).sort()).toEqual([...SOUND_EVENT_KEYS].sort());
    for (const key of SOUND_EVENT_KEYS) expect(table[key]).toBe('silent');
    expect(SOUND_EVENT_KEYS).toContain('Killed');
    expect(SOUND_EVENT_KEYS).toContain('Paused');
  });
});

describe('fallback to plain', () => {
  const base = completeFallback(plain);

  it('a manifest-only pack is plain in everything but its manifest, with a warning', () => {
    const { pack, warnings } = resolveStyle(good(), base);
    expect(pack.manifest.id).toBe('test-pack');
    expect(pack.theme).toEqual(base.theme);
    expect(pack.sounds).toEqual(base.sounds);
    expect(warnings.join('\n')).toContain('falls back to plain');
  });

  it('keeps what the pack gives and fills only what it misses', () => {
    const { pack } = resolveStyle(
      good({ theme: { palette: { enemy: 0x123456 } }, sounds: { Hit: beep } }),
      base,
    );
    expect(pack.theme.palette.enemy).toBe(0x123456);
    expect(pack.theme.palette.friendly).toBe(base.theme.palette.friendly);
    expect(pack.sounds.Hit).toBe(beep);
    expect(pack.sounds.Killed).toBe('silent');
  });

  it('an invalid part falls back whole, with a warning that says why', () => {
    const { pack, warnings } = resolveStyle(
      good({ theme: { palette: { enemy: -5 } }, sounds: { Hit: beep } }),
      base,
    );
    expect(pack.theme).toEqual(base.theme);
    expect(pack.sounds.Hit).toBe(beep);
    expect(warnings.join('\n')).toContain('theme is invalid');
  });

  it('lists what a pack misses', () => {
    expect(missingParts(plain)).toEqual([
      expect.stringContaining('deaths'),
      expect.stringContaining('explosions'),
    ]);
    expect(missingParts(good()).join('\n')).toContain('theme.palette');
  });

  it('plain is complete and reproduces the pre-Prototype-4 palette', () => {
    expect(base.theme.palette).toEqual({
      background: 0x05060d,
      friendly: 0x4ee1ff,
      enemy: 0xff5a5f,
      enemyStatic: 0xff9f45,
      turret: 0xc084fc,
      projectile: 0xfff27a,
      enemyShot: 0xff8fb0,
      fighter: 0xff3b6b,
      wingman: 0x7dffb0,
      missile: 0xffffff,
      lockRing: 0xffd24a,
      pod: 0x9ad8ff,
      star: 0x9fb4d9,
      dust: 0xcfe0ff,
    });
    expect(Object.keys(base.theme.palette).sort()).toEqual([...PALETTE_KEYS].sort());
  });
});
