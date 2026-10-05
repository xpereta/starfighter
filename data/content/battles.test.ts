import { describe, expect, it } from 'vitest';
import { createTuning, tuningParams } from '../tuning';
import { createCapitalConfig, capitalParams } from '../tuning/capital';
import { createGunshipConfig, gunshipParams } from '../tuning/gunship';
import { createLancerConfig, lancerParams } from '../tuning/lancer';
import { createWingsConfig, wingsParams } from '../tuning/wings';
import { turretsIn, wavesIn, waveSizeIn } from '../../src/core/run/run';
import { BATTLES } from './battles';
import { fighterKind } from './kinds/fighter';
import { createFighterConfig } from '../tuning/fighter';

describe('the default battle table is today’s behaviour (until the ramp rows change)', () => {
  const cfg = createTuning().run;
  cfg.ramp = 'classic';
  it('has one entry per battle of the run', () => {
    expect(BATTLES).toHaveLength(cfg.battleCount);
  });
  it('reproduces the waves, their sizes and the turrets of the run formulas', () => {
    BATTLES.forEach((battle, i) => {
      const n = i + 1;
      expect(battle.waves, `battle ${n} waves`).toHaveLength(wavesIn(cfg, n));
      for (const wave of battle.waves) {
        expect(wave.groups, `battle ${n}`).toEqual([
          { kind: 'fighter', count: waveSizeIn(cfg, n) },
        ]);
      }
      expect(battle.turrets, `battle ${n} turrets`).toBe(turretsIn(cfg, n));
      expect(battle.boss).toBeUndefined();
    });
  });
});

describe('the fighter kind is the existing fighter', () => {
  it('has the fighter tuning numbers', () => {
    const t = createFighterConfig();
    expect(fighterKind.hull).toBe(t.health);
    expect(fighterKind.radius).toBe(t.radius);
    expect(fighterKind.speedScale).toBe(t.speedScale);
    expect(fighterKind.turnScale).toBe(t.turnRateScale);
    const gun = fighterKind.mounts[0]!;
    expect(gun.fireRate).toBe(t.fireRate);
    expect(gun.bulletSpeed).toBe(t.bulletSpeed);
    expect(gun.range).toBe(t.fireRange);
  });
});

describe('prototype 5 tuning stubs', () => {
  const groups = {
    gunship: [gunshipParams, createGunshipConfig()],
    lancer: [lancerParams, createLancerConfig()],
    capital: [capitalParams, createCapitalConfig()],
    wings: [wingsParams, createWingsConfig()],
  } as const;
  it('every parameter has a default inside its range, a unit and a note', () => {
    for (const [name, [params, config]] of Object.entries(groups)) {
      for (const [key, def] of Object.entries(
        params as Record<
          string,
          { default: number; min: number; max: number; unit: string; note?: string }
        >,
      )) {
        expect(def.default, `${name}.${key}`).toBeGreaterThanOrEqual(def.min);
        expect(def.default, `${name}.${key}`).toBeLessThanOrEqual(def.max);
        expect(def.unit, `${name}.${key} unit`).not.toBeUndefined();
        expect((def.note ?? '').length, `${name}.${key} note`).toBeGreaterThan(20);
        expect((config as Record<string, number>)[key]).toBe(def.default);
      }
    }
  });
  it('gunship and wings are wired into Tuning (the panel and replays carry them)', () => {
    expect(Object.keys(tuningParams)).toEqual(expect.arrayContaining(['gunship', 'wings']));
    expect(createTuning().gunship).toEqual(createGunshipConfig());
    expect(createTuning().wings).toEqual(createWingsConfig());
  });
});
