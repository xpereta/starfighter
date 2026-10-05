import { afterEach, describe, expect, it } from 'vitest';
import { spectacleQualityPresets } from '../../../data/spectacle-quality';
import { createTuning } from '../../../data/tuning';
import { spectacle } from '../../../data/styles/anime-spectacle/spectacle';
import { createWorld, stepWorld } from '../../core/world/world';
import { initStyle } from '../style-active';
import { createSpectacleParts } from './index';
import { createShipFx, wingtips } from './ship-fx';
import { spectacleSettings } from './settings';

const DT = 1 / 60;
const def = spectacle.ships!;

afterEach(() => {
  initStyle('', null);
  spectacleSettings.ships = true;
});

describe('ship effects', () => {
  it('finds the wingtips of a shape: the extreme points either side of the nose', () => {
    initStyle('?style=anime-80s', null);
    const { left, right } = wingtips('player');
    expect(left[1]).toBeGreaterThan(0.5);
    expect(right[1]).toBeLessThan(-0.5);
    expect(left[1]).toBeCloseTo(-right[1]);
  });

  it('draws plumes and trails while flying, with every pool under its cap, at every level', () => {
    initStyle('?style=anime-spectacle', null);
    for (const level of ['low', 'medium', 'high'] as const) {
      const q = spectacleQualityPresets[level];
      const world = createWorld(31, createTuning());
      const fx = createShipFx(world, q);
      const a = world.actions;
      let sawPlume = false;
      let sawTrail = false;
      for (let i = 0; i < 20 * 60; i++) {
        a.throttle = 1;
        a.steerX = Math.sin(i / 50);
        a.fire = i % 30 === 0;
        a.evade = i % 240 === 0;
        a.launch = i % 400 === 0;
        stepWorld(world, DT);
        fx.consume(world.events.events);
        fx.update({ dt: DT, time: i * DT, speedFactor: 0.8 }, def, true);
        const s = fx.stats();
        sawPlume ||= s.plumes > 0;
        sawTrail ||= s.ribbons > 0;
        expect(s.ribbons).toBeLessThanOrEqual(q.ribbons);
        expect(s.launchFlashes).toBeLessThanOrEqual(16);
      }
      expect(sawPlume).toBe(true);
      expect(sawTrail).toBe(true);
      fx.dispose();
    }
  });

  it('no trails with zero width, and everything is cleared and hidden when switched off', () => {
    initStyle('?style=anime-spectacle', null);
    const world = createWorld(31, createTuning());
    const fx = createShipFx(world, spectacleQualityPresets.high);
    const flat = { ...def, trails: { ...def.trails, width: 0 } };
    for (let i = 0; i < 240; i++) {
      stepWorld(world, DT);
      fx.update({ dt: DT, time: i * DT, speedFactor: 1 }, flat, true);
    }
    expect(fx.stats().ribbons).toBe(0);
    for (let i = 0; i < 60; i++) {
      stepWorld(world, DT);
      fx.update({ dt: DT, time: i * DT, speedFactor: 1 }, def, true);
    }
    expect(fx.stats().ribbons).toBeGreaterThan(0);
    fx.update({ dt: DT, time: 0, speedFactor: 1 }, def, false);
    expect(fx.object.visible).toBe(false);
    expect(fx.stats().ribbons).toBe(0);
  });

  it('is part of the spectacle parts only for a pack that has the section, and obeys the panel switch', () => {
    initStyle('?style=anime-80s', null);
    const world = createWorld(31, createTuning());
    const parts = createSpectacleParts(world, 'medium');
    const frame = { dt: DT, time: 0, camX: 0, camY: 0, viewW: 2400, viewH: 1500, speedFactor: 0.5 };
    parts.update(frame);
    expect(parts.stats().ships).toBeNull();
    initStyle('?style=anime-spectacle', null);
    parts.update(frame);
    expect(parts.stats().ships).not.toBeNull();
    spectacleSettings.ships = false;
    parts.update(frame);
    expect(parts.stats().ships).toBeNull();
  });
});
