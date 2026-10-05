import { describe, expect, it } from 'vitest';
import { loops, sounds } from '../../data/styles/realistic/sounds';
import { styles } from '../../data/styles';
import { buildStyles, SOUND_DEFAULT_STYLE } from '../render/style-active';
import {
  checkStyle,
  LOOP_KEYS,
  SOUND_EVENT_KEYS,
  validateLoops,
  validateSounds,
  type SoundEntry,
  type StyleInput,
} from '../render/style';
import { soundDuration } from './planner';

const entries = SOUND_EVENT_KEYS.flatMap((k) => {
  const e = sounds[k];
  return e === 'silent' ? [] : [[k, e] as [string, SoundEntry]];
});

describe('the realistic pack', () => {
  it('validates as a pack, and parents plain so only the sound is its own', () => {
    expect(checkStyle(styles.realistic!)).toEqual([]);
    expect(styles.realistic!.manifest.parent).toBe('plain');
    expect(styles.realistic!.theme).toBeUndefined();
    expect(styles.realistic!.ships).toBeUndefined();
  });

  it('has an entry or an explicit silent for every event and every loop; only the pilot-kill blip is silent', () => {
    expect(validateSounds(sounds)).toEqual([]);
    expect(validateLoops(loops)).toEqual([]);
    for (const k of SOUND_EVENT_KEYS) {
      if (sounds[k] === 'silent') expect(k).toBe('PilotKill');
      else expect(sounds[k]).toBeDefined();
    }
    for (const k of LOOP_KEYS) expect(loops[k], k).not.toBe('silent');
  });

  it('is quiet and short: no sound over 0.6, none longer than 4 s, none inaudible', () => {
    for (const [k, e] of entries) {
      expect(e.volume, k).toBeLessThanOrEqual(0.6);
      expect(e.volume, k).toBeGreaterThanOrEqual(0.05);
      expect(soundDuration(e.source), k).toBeLessThan(4);
    }
  });

  it('every loop is low (nothing continuous masks a gun or a hit)', () => {
    for (const k of LOOP_KEYS) {
      const e = loops[k];
      if (e === 'silent') continue;
      expect(e.volume, k).toBeLessThanOrEqual(0.2);
    }
    // The bed under everything is the quietest of all.
    expect((loops.ambient as { volume: number }).volume).toBeLessThanOrEqual(0.08);
  });

  it('gives every sound its own recipe', () => {
    const seen = new Map<string, string>();
    for (const [k, e] of entries) {
      const id = JSON.stringify(e.source);
      expect(seen.get(id), `${k} duplicates ${seen.get(id)}`).toBeUndefined();
      seen.set(id, k);
    }
  });

  it('automatic fire is throttled: at most ~13 voiced player shots a second, fewer for the others', () => {
    const gun = (k: 'ShotFired' | 'WingmanShotFired' | 'EnemyShotFired'): SoundEntry =>
      sounds[k] as SoundEntry;
    expect(1 / gun('ShotFired').minGap).toBeLessThanOrEqual(13.5);
    expect(gun('ShotFired').maxVoices).toBeLessThanOrEqual(3);
    expect(gun('WingmanShotFired').minGap).toBeGreaterThan(gun('ShotFired').minGap);
    expect(gun('EnemyShotFired').minGap).toBeGreaterThan(gun('ShotFired').minGap);
    // Player, wingman and enemy guns are three different sounds, the others further away.
    expect(gun('WingmanShotFired').spatial).toBeDefined();
    expect(gun('EnemyShotFired').spatial).toBeDefined();
    expect(gun('WingmanShotFired').volume).toBeLessThan(gun('ShotFired').volume);
  });

  it('explosions have a sub thump, a delayed secondary blast and a long reverberant tail', () => {
    const k = sounds.Killed as SoundEntry;
    if (k.source.kind !== 'synth') throw new Error('Killed must be synthesised');
    const layers = k.source.layers;
    expect(layers.some((l) => l.waveform === 'sine' && l.freq <= 90)).toBe(true);
    expect(layers.filter((l) => (l.delay ?? 0) >= 0.25).length).toBeGreaterThanOrEqual(2);
    expect(Math.max(...layers.map((l) => l.attack + l.decay))).toBeGreaterThan(1.5);
    expect(k.reverb).toBeGreaterThanOrEqual(0.4);
    expect(k.size).toBeDefined();
    expect(k.duckLoops).toBeDefined();
  });

  it('things out in the arena are muffled, wetter and late with distance', () => {
    for (const key of [
      'Hit',
      'WingmanShotFired',
      'EnemyShotFired',
      'WingmanHit',
      'WingmanDown',
      'MissileLaunched',
      'MissileImpact',
      'Killed',
      'PodSpawned',
    ] as const) {
      const sp = (sounds[key] as SoundEntry).spatial;
      expect(sp?.lowpass, key).toBeDefined();
      expect(sp!.lowpass!.far, key).toBeLessThan(sp!.lowpass!.near);
      expect(sp!.farReverb, key).toBeGreaterThan(0);
      expect(sp!.lag, key).toBeGreaterThan(0);
    }
  });

  it('uses the new synthesis: grit, noise colours, tremolo and holds appear somewhere', () => {
    const layers = entries.flatMap(([, e]) => (e.source.kind === 'synth' ? e.source.layers : []));
    expect(layers.some((l) => (l.distortion ?? 0) > 0)).toBe(true);
    expect(layers.some((l) => l.waveform === 'brown')).toBe(true);
    expect(layers.some((l) => l.waveform === 'pink')).toBe(true);
    expect(layers.some((l) => l.tremolo)).toBe(true);
    expect(layers.some((l) => l.hold)).toBe(true);
    expect(layers.some((l) => l.detune)).toBe(true);
  });

  it('the hull alarm only runs when the hull is low, the afterburner only under throttle', () => {
    const hull = loops.hullAlarm as { gain: { points: readonly (readonly [number, number])[] } };
    expect(hull.gain.points[0]![1]).toBe(1); // hull 0 = alarm
    expect(hull.gain.points[hull.gain.points.length - 1]![1]).toBe(0); // hull full = quiet
    const burner = loops.afterburner as {
      gain: { points: readonly (readonly [number, number])[] };
    };
    expect(burner.gain.points[0]![1]).toBe(0);
  });
});

describe('realistic as the default sound', () => {
  const resolved = buildStyles(styles);

  it('?style=realistic: sounds and loops are its own, the look is the parent’s', () => {
    const pack = resolved.realistic!.pack;
    const plain = resolved.plain!.pack;
    expect(pack.sounds.ShotFired).toBe(sounds.ShotFired);
    expect(pack.loops.engine).toBe(loops.engine);
    expect(pack.theme).toEqual(plain.theme);
    expect(pack.ships).toEqual(plain.ships);
    expect(pack.music).toBeNull();
  });

  it('a pack with no parent and no sound table gets the realistic sounds and loops', () => {
    expect(SOUND_DEFAULT_STYLE).toBe('realistic');
    const bare: StyleInput = { manifest: { ...styles.plain!.manifest, id: 'bare', parent: null } };
    const out = buildStyles({ ...styles, bare });
    expect(out.bare!.pack.sounds.Killed).toBe(sounds.Killed);
    expect(out.bare!.pack.loops.engine).toBe(loops.engine);
  });

  it('a pack keeps its own sounds and takes only the entries it lacks', () => {
    const anime = resolved['anime-80s']!.pack;
    expect(anime.sounds.Killed).toBe(styles['anime-80s']!.sounds!.Killed);
    expect(anime.sounds.MenuMove).toBe(sounds.MenuMove);
    expect(anime.loops.engine).toBe(loops.engine);
  });

  it('a pack whose parent is another pack builds on that parent, not on realistic', () => {
    const child: StyleInput = {
      manifest: { ...styles.plain!.manifest, id: 'child', parent: 'anime-80s' },
    };
    const out = buildStyles({ ...styles, child });
    expect(out.child!.pack.sounds.Killed).toBe(out['anime-80s']!.pack.sounds.Killed);
  });
});
