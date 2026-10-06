import { afterEach, describe, expect, it } from 'vitest';
import { createTuning } from '../../../data/tuning';
import { spectacleQualityPresets } from '../../../data/spectacle-quality';
import { spectacle } from '../../../data/styles/anime-spectacle/spectacle';
import { createWorld, stepWorld } from '../../core/world/world';
import { initStyle } from '../style-active';
import { createPaletteBlend, ease, lerpHex, paletteIndex, wrapOffset } from './backdrop-logic';
import { createSpectacleParts, type SpectacleFrame } from './index';
import { spectacleSettings } from './settings';

const def = spectacle.backdrop!;

describe('backdrop palettes', () => {
  it('practice mode and battle 1 use the first palette, then the battles cycle', () => {
    expect(paletteIndex(0, 4)).toBe(0);
    expect(paletteIndex(1, 4)).toBe(0);
    expect(paletteIndex(2, 4)).toBe(1);
    expect(paletteIndex(4, 4)).toBe(3);
    expect(paletteIndex(5, 4)).toBe(0);
    expect(paletteIndex(3, 0)).toBe(0);
  });

  it('lerps colours channel by channel and clamps', () => {
    expect(lerpHex(0x000000, 0xff8040, 0)).toBe(0x000000);
    expect(lerpHex(0x000000, 0xff8040, 1)).toBe(0xff8040);
    expect(lerpHex(0x000000, 0xff0000, 0.5)).toBe(0x800000);
    expect(lerpHex(0x102030, 0x102030, 7)).toBe(0x102030);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
  });

  it('jumps to the first palette, then eases to the next over the shift time, fading structures across', () => {
    const b = createPaletteBlend();
    b.step(0.016, 1, def);
    expect(b.colors.sky).toBe(def.palettes[0]!.sky);
    expect(b.structureAlpha('planet')).toBe(1);
    expect(b.structureAlpha('carrier')).toBe(0);
    b.step(def.shift / 2, 2, def); // the second battle starts: half way
    const mid = b.colors.sky;
    expect(mid).not.toBe(def.palettes[0]!.sky);
    expect(mid).not.toBe(def.palettes[1]!.sky);
    expect(b.structureAlpha('planet')).toBeCloseTo(0.5, 1);
    expect(b.structureAlpha('carrier')).toBeCloseTo(0.5, 1);
    b.step(def.shift, 2, def);
    expect(b.colors.sky).toBe(def.palettes[1]!.sky);
    expect(b.structureAlpha('carrier')).toBe(1);
    expect(b.structureAlpha('planet')).toBe(0);
  });

  it('wraps a layer into a box around the camera, keeping the density and moving with the shift', () => {
    for (const u of [0, 0.25, 0.5, 0.99]) {
      for (const shift of [-5000, 0, 123, 99999]) {
        const o = wrapOffset(u, shift, 1000);
        expect(o).toBeGreaterThanOrEqual(-500);
        expect(o).toBeLessThan(500);
      }
    }
    // A bigger parallax shift moves the thing by exactly that much (until it wraps).
    expect(wrapOffset(0, 0, 1000)).toBeCloseTo(0);
    expect(wrapOffset(0, 100, 1000)).toBeCloseTo(-100);
  });
});

describe('backdrop parts (headless)', () => {
  afterEach(() => {
    initStyle('', null);
    spectacleSettings.backdrop = true;
    spectacleSettings.sky = 0;
  });

  const frame = (time: number): SpectacleFrame => ({
    dt: 1 / 60,
    time,
    camX: time * 100,
    camY: 0,
    viewW: 2400,
    viewH: 1500,
    speedFactor: 0.5,
  });

  it('has nothing for a style without a spectacle', () => {
    initStyle('?style=anime-80s', null);
    const world = createWorld(5, createTuning());
    const parts = createSpectacleParts(world, 'high');
    parts.update(frame(0));
    expect(parts.stats().backdrop).toBeNull();
    expect(parts.skyColor()).toBeNull();
    expect(parts.object.children).toHaveLength(0);
  });

  it('builds the layers the quality level allows and keeps every pool under its cap', () => {
    initStyle('?style=anime-spectacle', null);
    for (const level of ['low', 'medium', 'high'] as const) {
      const q = spectacleQualityPresets[level];
      const world = createWorld(5, createTuning());
      const parts = createSpectacleParts(world, level);
      for (let i = 0; i < 1200; i++) {
        stepWorld(world, 1 / 60);
        parts.consume(world.events.events);
        parts.update(frame(i / 60));
        const s = parts.stats().backdrop!;
        expect(s.nebulaLayers).toBeLessThanOrEqual(q.nebulaLayers);
        expect(s.starLayers).toBeLessThanOrEqual(q.extraStars);
        expect(s.rocks).toBeLessThanOrEqual(Math.min(q.debris, def.debris.count));
        expect(s.flashes).toBeLessThanOrEqual(q.flashes);
      }
      expect(parts.stats().backdrop!.nebulaLayers).toBe(
        Math.min(q.nebulaLayers, def.nebula.layers),
      );
      expect(parts.skyColor()).toBe(def.palettes[0]!.sky);
      parts.dispose();
    }
  });

  it('the sky follows the chosen battle and the switch turns it off', () => {
    initStyle('?style=anime-spectacle', null);
    const world = createWorld(5, createTuning());
    const parts = createSpectacleParts(world, 'medium');
    spectacleSettings.sky = 3;
    for (let i = 0; i < 600; i++) parts.update(frame(i / 60)); // ten seconds: the shift (3 s) is done
    expect(parts.skyColor()).toBe(def.palettes[2]!.sky);
    spectacleSettings.backdrop = false;
    parts.update(frame(11));
    expect(parts.skyColor()).toBeNull();
    expect(parts.stats().backdrop).toBeNull();
  });
});
