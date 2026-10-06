import { describe, expect, it } from 'vitest';
import { createMixConfig } from '../../data/audio/mix';
import { music, score } from '../../data/styles/anime-spectacle/music';
import { music as loopMusic } from '../../data/styles/anime-80s/sounds';
import { silentSoundTable, type MusicDef } from '../render/style';
import type { MusicInput } from './conductor';
import { createAudioEngine } from './engine';
import { createFakeBackend } from './fake-backend';

const flight = (over: Partial<MusicInput> = {}): MusicInput => ({
  scene: 'flight',
  enemies: 0,
  hull: 1,
  rescue: 0,
  ...over,
});

function setup(track: MusicDef | null) {
  const backend = createFakeBackend();
  const engine = createAudioEngine({
    backend,
    table: () => silentSoundTable(),
    music: () => track,
    mix: createMixConfig(),
  });
  const run = (seconds: number, input: MusicInput): void => {
    const dt = 1 / 60;
    for (let t = 0; t < seconds; t += dt) {
      backend.now += dt;
      engine.setMusicState(input, dt);
    }
  };
  return { backend, engine, run };
}

describe('the adaptive score in the engine', () => {
  it('does nothing before the audio is unlocked', () => {
    const { backend, run } = setup(music);
    run(3, flight());
    expect(backend.bars).toHaveLength(0);
    expect(backend.scoreVolume).toBeNull();
  });

  it('starts the score bus on unlock (not the loop track) and plans bars as time passes', () => {
    const { backend, engine, run } = setup(music);
    engine.unlock();
    expect(backend.scoreVolume).toBe(music.volume);
    expect(backend.stingerLevel).toBe(score.stingerLevel);
    expect(backend.music).toBeNull();
    run(10, flight({ enemies: 4 }));
    expect(backend.bars.length).toBeGreaterThanOrEqual(4);
    expect(engine.musicStatus?.cue).toBe('battle');
    expect(engine.musicStatus?.intensity).toBeGreaterThan(0.3);
  });

  it('stops planning while paused and resumes after', () => {
    const { backend, engine, run } = setup(music);
    engine.unlock();
    run(5, flight());
    const before = backend.bars.length;
    engine.setPaused(true);
    run(6, flight());
    expect(backend.bars.length).toBe(before);
    engine.setPaused(false);
    run(6, flight());
    expect(backend.bars.length).toBeGreaterThan(before);
  });

  it('events call stingers, which reach the backend on the grid', () => {
    const { backend, engine, run } = setup(music);
    engine.unlock();
    run(4, flight());
    engine.consumeEvents([{ type: 'BattleStarted', battle: 1 }], { x: 0, y: 0 });
    run(1, flight());
    expect(backend.stingers.map((s) => s.key)).toEqual(['battleStart']);
    expect(backend.stingers[0]!.time).toBeGreaterThan(backend.now - 1);
    expect(backend.stingers[0]!.notes.length).toBeGreaterThan(10);
  });

  it('the panel can play any stinger by key, and a lower priority does not cut a higher one', () => {
    const { backend, engine, run } = setup(music);
    engine.unlock();
    run(3, flight());
    engine.playStinger('rescued');
    run(1, flight());
    expect(backend.stingers.map((s) => s.key)).toEqual(['rescued']);
    engine.playStinger('finale');
    run(1, flight());
    engine.playStinger('beacon'); // lower priority while the finale plays: dropped
    run(1, flight());
    expect(backend.stingers.map((s) => s.key)).toEqual(['rescued', 'finale']);
    expect(backend.stingers[1]!.mute).toBe(true);
  });

  it('the panel can force the scene and the intensity, and release it', () => {
    const { engine, run } = setup(music);
    engine.unlock();
    engine.forceMusic({ scene: 'menu', intensity: 0.7 });
    run(3, flight());
    expect(engine.musicStatus?.cue).toBe('menu');
    expect(engine.musicStatus?.intensity).toBe(0.7);
    engine.forceMusic(null);
    run(8, flight());
    expect(engine.musicStatus?.cue).toBe('battle');
    expect(engine.musicStatus?.forced).toBeNull();
  });

  it('a style without a score keeps the old loop track and plans nothing', () => {
    const { backend, engine, run } = setup(loopMusic);
    engine.unlock();
    expect(backend.music).toBe(loopMusic);
    expect(backend.scoreVolume).toBeNull();
    run(5, flight());
    expect(backend.bars).toHaveLength(0);
    expect(engine.musicStatus).toBeNull();
  });

  it('switching the track to a score (a style change) starts it and stops the loop', () => {
    let track: MusicDef = loopMusic;
    const backend = createFakeBackend();
    const engine = createAudioEngine({
      backend,
      table: () => silentSoundTable(),
      music: () => track,
      mix: createMixConfig(),
    });
    engine.unlock();
    track = music;
    engine.refreshMusic();
    expect(backend.music).toBeNull();
    expect(backend.scoreVolume).toBe(music.volume);
    track = loopMusic;
    engine.refreshMusic();
    expect(backend.music).toBe(loopMusic);
    expect(backend.scoreVolume).toBeNull();
  });

  it('a live edit of the track volume reaches the backend', () => {
    const edited: MusicDef = { volume: 0.5, source: music.source };
    const backend = createFakeBackend();
    const engine = createAudioEngine({
      backend,
      table: () => silentSoundTable(),
      music: () => edited,
      mix: createMixConfig(),
    });
    engine.unlock();
    edited.volume = 0.25;
    backend.now += 0.1;
    engine.setMusicState(flight(), 0.1);
    expect(backend.scoreVolume).toBe(0.25);
  });
});
