import { describe, expect, it } from 'vitest';
import { createTuning, tuningParams } from '../tuning';
import { createCapitalConfig, capitalParams } from '../tuning/capital';
import { createGunshipConfig, gunshipParams } from '../tuning/gunship';
import { createLancerConfig, lancerParams } from '../tuning/lancer';
import { createWingsConfig, wingsParams } from '../tuning/wings';
import { battleDefOf, bossOf, turretsIn, wavesIn, waveSizeIn } from '../../src/core/run/run';
import { BATTLES } from './battles';
import { fighterKind } from './kinds/fighter';
import { createFighterConfig } from '../tuning/fighter';

const count = (battle: (typeof BATTLES)[number], kind: string): number =>
  battle.waves.reduce(
    (n, w) => n + w.groups.filter((g) => g.kind === kind).reduce((m, g) => m + g.count, 0),
    0,
  );

describe('the authored ramp (spec section 6)', () => {
  const cfg = createTuning().run;
  it('has one entry per battle of the run', () => {
    expect(BATTLES).toHaveLength(cfg.battleCount);
  });
  it('battle 1: fighters, one formation wing in the last wave only', () => {
    const b = BATTLES[0]!;
    expect(count(b, 'wing')).toBe(1);
    expect(b.waves.at(-1)!.groups.some((g) => g.kind === 'wing')).toBe(true);
    expect(count(b, 'gunship')).toBe(0);
    expect(b.turrets).toBe(0);
  });
  it('battle 2: fighters, wings and one gunship in wave 2', () => {
    const b = BATTLES[1]!;
    expect(count(b, 'gunship')).toBe(1);
    expect(b.waves[1]!.groups.some((g) => g.kind === 'gunship')).toBe(true);
    expect(count(b, 'wing')).toBeGreaterThanOrEqual(1);
  });
  it('battle 3: wings, two gunships, a lone missile fighter first and then a pair', () => {
    const b = BATTLES[2]!;
    expect(count(b, 'wing')).toBeGreaterThanOrEqual(1);
    expect(count(b, 'gunship')).toBe(2);
    const lancers = b.waves.map((w) => count({ waves: [w], turrets: 0 }, 'lancer')).filter(Boolean);
    expect(lancers).toEqual([1, 2]);
  });
  it('battle 4 is the capital ship boss (its escorts come from the boss script), classic has none', () => {
    const classic = { ...cfg, ramp: 'classic' as const };
    expect(BATTLES[3]!.boss).toBe('capital');
    expect(BATTLES[3]!.turrets).toBe(turretsIn(cfg, 4));
    expect(battleDefOf(classic, 4).boss).toBeUndefined();
    expect(bossOf(cfg, 4)).toBe('capital');
    expect(bossOf(classic, 4)).toBeUndefined();
  });
  it('the classic ramp is still selectable and reproduces the old formulas', () => {
    const classic = { ...cfg, ramp: 'classic' as const };
    for (let n = 1; n <= cfg.battleCount; n++) {
      const plan = battleDefOf(classic, n);
      expect(plan.waves, `battle ${n} waves`).toHaveLength(wavesIn(cfg, n));
      for (const wave of plan.waves) {
        expect(wave.groups).toEqual([{ kind: 'fighter', count: waveSizeIn(cfg, n) }]);
      }
      expect(plan.turrets).toBe(turretsIn(cfg, n));
    }
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
