import { afterEach, describe, expect, it } from 'vitest';
import { spectacleQualityPresets } from '../../../data/spectacle-quality';
import { spectacle } from '../../../data/styles/anime-spectacle/spectacle';
import { createTuning } from '../../../data/tuning';
import { createWorld, stepWorld } from '../../core/world/world';
import { BLAST_KINDS } from '../spectacle-contract';
import { createCombatFx } from './combat-fx';
import { demoEvents } from './demo';
import { spectacleSettings } from './settings';

const DT = 1 / 60;
const def = spectacle.combat!;

afterEach(() => {
  spectacleSettings.combat = true;
});

describe('combat effects', () => {
  it('has a recipe for every kind and the turret is the biggest blast', () => {
    for (const k of BLAST_KINDS) expect(def.recipes[k]).toBeDefined();
    for (const k of ['fighter', 'drone', 'static', 'wingman'] as const) {
      expect(def.recipes.turret.fireball).toBeGreaterThan(def.recipes[k].fireball);
      expect(def.recipes.turret.chain).toBeGreaterThan(def.recipes[k].chain);
    }
  });

  it('a demo of blasts fills the pools, calls the hooks, and everything ends within a few seconds', () => {
    const world = createWorld(3, createTuning());
    const calls = { punch: 0, hit: 0 };
    const fx = createCombatFx(world, spectacleQualityPresets.high, {
      punch: () => calls.punch++,
      hit: () => calls.hit++,
    });
    fx.update(DT, def, true);
    fx.consume(demoEvents(world), def);
    expect(calls.punch).toBeGreaterThan(0);
    expect(calls.hit).toBeGreaterThan(0);
    fx.update(DT, def, true);
    const s = fx.stats();
    expect(s.elements).toBeGreaterThan(10);
    expect(s.sparks).toBeGreaterThan(50);
    expect(s.queued).toBeGreaterThan(5);
    for (let i = 0; i < 10 * 60; i++) fx.update(DT, def, true); // blasts are stretched (tempo), so give them longer
    const end = fx.stats();
    expect(end.elements + end.sparks + end.blots + end.queued).toBe(0);
    fx.dispose();
  });

  it('never exceeds its caps at any level, even under a storm of kills', () => {
    for (const level of ['low', 'medium', 'high'] as const) {
      const q = spectacleQualityPresets[level];
      const world = createWorld(3, createTuning());
      const fx = createCombatFx(world, q, { punch: () => {}, hit: () => {} });
      for (let i = 0; i < 300; i++) {
        stepWorld(world, DT);
        if (i % 3 === 0) fx.consume(demoEvents(world), def);
        fx.update(DT, def, true);
        const s = fx.stats();
        expect(s.elements).toBeLessThanOrEqual(q.ringCap);
        expect(s.sparks).toBeLessThanOrEqual(q.sparkCap);
        expect(s.blots).toBeLessThanOrEqual(q.blotCap);
        expect(s.queued).toBeLessThanOrEqual(q.queueCap);
      }
      fx.dispose();
    }
  });

  it('does nothing when switched off, and clears what was running', () => {
    const world = createWorld(3, createTuning());
    const fx = createCombatFx(world, spectacleQualityPresets.high, {
      punch: () => {},
      hit: () => {},
    });
    fx.consume(demoEvents(world), def);
    fx.update(DT, def, true);
    expect(fx.stats().elements).toBeGreaterThan(0);
    spectacleSettings.combat = false;
    fx.consume(demoEvents(world), def);
    fx.update(DT, def, false);
    expect(fx.object.visible).toBe(false);
    expect(fx.stats().elements + fx.stats().sparks).toBe(0);
  });
});
