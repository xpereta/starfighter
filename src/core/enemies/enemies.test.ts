import { describe, expect, it } from 'vitest';
import { ENEMY_KINDS } from '../../../data/content/enemies';
import { fighterKind } from '../../../data/content/kinds/fighter';
import { validateBattleTable, type BattleDef } from './battles';
import { validateCapitalParts, type CapitalPartDef } from './capital-parts';
import {
  validateEnemyKind,
  validateEnemyKinds,
  type EnemyKind,
  type EnemyKindTable,
} from './kinds';
import { validateMount, type WeaponMount } from './mounts';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const mount = (): WeaponMount => clone(fighterKind.mounts[0]!);

describe('weapon mounts', () => {
  it('accepts a good mount', () => expect(() => validateMount(mount())).not.toThrow());
  it('rejects bad ones loudly', () => {
    const bad = (f: (m: WeaponMount) => void): WeaponMount => {
      const m = mount();
      f(m);
      return m;
    };
    expect(() => validateMount(bad((m) => (m.id = 'Nose Gun')))).toThrow(/id/);
    expect(() => validateMount(bad((m) => (m.arcHalf = 4)))).toThrow(/arcHalf/);
    expect(() => validateMount(bad((m) => (m.fireRate = 0)))).toThrow(/fireRate/);
    expect(() => validateMount(bad((m) => (m.range = NaN)))).toThrow(/range/);
    expect(() => validateMount(bad((m) => (m.burst.shots = 1.5)))).toThrow(/burst.shots/);
    expect(() => validateMount(bad((m) => (m.burst.pause = -1)))).toThrow(/burst.pause/);
  });
});

describe('enemy kinds', () => {
  it('the shipped table is valid and every kind is keyed by its own id', () => {
    expect(() => validateEnemyKinds(ENEMY_KINDS)).not.toThrow();
  });
  it('rejects bad kinds and bad tables', () => {
    const bad = (f: (k: EnemyKind) => void): EnemyKind => {
      const k = clone(fighterKind);
      f(k);
      return k;
    };
    expect(() => validateEnemyKind(bad((k) => (k.hull = 0)))).toThrow(/hull/);
    expect(() => validateEnemyKind(bad((k) => (k.radius = -3)))).toThrow(/radius/);
    expect(() => validateEnemyKind(bad((k) => (k.speedScale = NaN)))).toThrow(/speedScale/);
    expect(() => validateEnemyKind(bad((k) => (k.ai = 'nope' as never)))).toThrow(/ai/);
    expect(() => validateEnemyKind(bad((k) => (k.fromBattle = 0)))).toThrow(/fromBattle/);
    expect(() => validateEnemyKind(bad((k) => (k.label = ' ')))).toThrow(/label/);
    expect(() => validateEnemyKind(bad((k) => k.mounts.push(mount())))).toThrow(/two mounts/);
    expect(() => validateEnemyKind(bad((k) => (k.mounts[0]!.bulletSpeed = 1)))).toThrow(
      /bulletSpeed/,
    );
    const missing = clone(ENEMY_KINDS) as Partial<EnemyKindTable>;
    delete missing.lancer;
    expect(() => validateEnemyKinds(missing as EnemyKindTable)).toThrow(/lancer/);
    const swapped = { ...ENEMY_KINDS, gunship: ENEMY_KINDS.lancer };
    expect(() => validateEnemyKinds(swapped)).toThrow(/keyed "gunship"/);
  });
  it('the fighter kind carries the fighter tuning defaults', () => {
    expect(fighterKind.mounts).toHaveLength(1);
    expect(fighterKind.ai).toBe('fighter');
  });
});

const part = (
  id: string,
  role: CapitalPartDef['role'],
  extra: Partial<CapitalPartDef> = {},
): CapitalPartDef => ({
  id,
  role,
  x: 0,
  y: 0,
  radius: 40,
  hp: 5,
  covers: [],
  ...extra,
});
const goodParts = (): CapitalPartDef[] => [
  part('core', 'core'),
  part('plate-1', 'armour', { x: 100, covers: ['core'] }),
  part('engine-1', 'engine', { x: -300, y: 60 }),
  part('bridge', 'bridge', { x: 200 }),
  part('gun-1', 'turret', { x: 150, y: 100, mount: mount() }),
];

describe('capital ship parts', () => {
  it('accepts a legal ship', () => {
    expect(() => validateCapitalParts(goodParts(), 700)).not.toThrow();
  });
  it('rejects illegal ones', () => {
    const without = (id: string): CapitalPartDef[] => goodParts().filter((p) => p.id !== id);
    const edit = (f: (p: CapitalPartDef[]) => void): CapitalPartDef[] => {
      const p = goodParts();
      f(p);
      return p;
    };
    expect(() => validateCapitalParts([])).toThrow(/core/);
    expect(() => validateCapitalParts(without('core'))).toThrow(/core/);
    expect(() => validateCapitalParts(without('engine-1'))).toThrow(/engine/);
    expect(() => validateCapitalParts(without('plate-1'))).toThrow(/does not exist|plate|armour/);
    expect(() => validateCapitalParts(edit((p) => p.push(part('core', 'engine'))))).toThrow(
      /twice/,
    );
    expect(() => validateCapitalParts(edit((p) => p.push(part('b2', 'bridge'))))).toThrow(/bridge/);
    expect(() => validateCapitalParts(edit((p) => (p[4]!.mount = undefined)))).toThrow(/mount/);
    expect(() => validateCapitalParts(edit((p) => (p[2]!.mount = mount())))).toThrow(
      /not a turret/,
    );
    expect(() => validateCapitalParts(edit((p) => (p[2]!.covers = ['core'])))).toThrow(
      /not armour/,
    );
    expect(() => validateCapitalParts(edit((p) => (p[1]!.covers = ['ghost'])))).toThrow(/ghost/);
    expect(() => validateCapitalParts(edit((p) => (p[1]!.covers = ['plate-1'])))).toThrow(/itself/);
    expect(() => validateCapitalParts(edit((p) => (p[0]!.hp = 0)))).toThrow(/hp/);
    expect(() => validateCapitalParts(edit((p) => (p[0]!.role = 'hull' as never)))).toThrow(/role/);
    expect(() =>
      validateCapitalParts(
        edit((p) => (p[2]!.x = -900)),
        700,
      ),
    ).toThrow(/outside the hull/);
  });
  it('a core with no plate in front has no order of play', () => {
    const parts = goodParts();
    parts[1]!.covers = [];
    expect(() => validateCapitalParts(parts)).toThrow(/covers the core/);
  });
});

describe('battle table validation', () => {
  const battle = (): BattleDef => ({
    waves: [{ groups: [{ kind: 'fighter', count: 3 }] }],
    turrets: 0,
  });
  it('accepts a good table, with wings and a boss', () => {
    const b = battle();
    b.waves.push({ groups: [{ kind: 'wing', count: 1 }] });
    b.boss = 'capital';
    expect(() => validateBattleTable([b], ENEMY_KINDS)).not.toThrow();
  });
  it('a wing group may name its size (3 to 5), nothing else may', () => {
    const b = battle();
    b.waves.push({ groups: [{ kind: 'wing', count: 1, size: 3 }] });
    expect(() => validateBattleTable([b], ENEMY_KINDS)).not.toThrow();
    b.waves[1]!.groups[0]!.size = 7;
    expect(() => validateBattleTable([b], ENEMY_KINDS)).toThrow(/size/);
    b.waves[1]!.groups[0] = { kind: 'fighter', count: 1, size: 3 };
    expect(() => validateBattleTable([b], ENEMY_KINDS)).toThrow(/only a wing/);
  });
  it('rejects bad ones', () => {
    expect(() => validateBattleTable([])).toThrow(/empty/);
    expect(() => validateBattleTable([{ waves: [], turrets: 0 }])).toThrow(/no waves/);
    expect(() => validateBattleTable([{ waves: [{ groups: [] }], turrets: 0 }])).toThrow(
      /no groups/,
    );
    const unknown = battle();
    unknown.waves[0]!.groups[0]!.kind = 'dreadnought' as never;
    expect(() => validateBattleTable([unknown])).toThrow(/kind/);
    const count = battle();
    count.waves[0]!.groups[0]!.count = 0;
    expect(() => validateBattleTable([count])).toThrow(/count/);
    const turrets = battle();
    turrets.turrets = -1;
    expect(() => validateBattleTable([turrets])).toThrow(/turrets/);
    const boss = battle();
    boss.boss = 'moon' as never;
    expect(() => validateBattleTable([boss])).toThrow(/boss/);
    const early = battle();
    early.waves[0]!.groups[0]!.kind = 'gunship'; // gunships start in battle 2
    expect(() => validateBattleTable([early], ENEMY_KINDS)).toThrow(/from battle 2/);
  });
});
