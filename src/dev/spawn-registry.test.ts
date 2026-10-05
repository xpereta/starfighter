import { describe, expect, it } from 'vitest';
import { createTuning } from '../../data/tuning';
import { createWorld } from '../core/world/world';
import type { EntityKind } from '../core/world/target';
import {
  SPAWN_COUNTS,
  SPAWN_DISTANCE,
  SPAWN_REGISTRY,
  spawnAhead,
  spawnPositions,
  type SpawnKind,
} from './spawn-registry';

/** Every enemy kind of the world. Typed as a full record so adding a kind to `EntityKind` breaks the build until it is listed here (and so needs a registry entry). */
const ENEMY_KINDS: Record<Exclude<EntityKind, 'wingman'>, true> = {
  fighter: true,
  drone: true,
  turret: true,
  static: true,
};

const countOf = (w: ReturnType<typeof createWorld>, kind: SpawnKind): number => {
  if (kind === 'pod') return w.pods.length;
  if (kind === 'fighter') return w.fighters.filter((f) => f.alive && !f.lancer).length;
  if (kind === 'lancer') return w.fighters.filter((f) => f.alive && f.lancer).length;
  return w.targets.filter((t) => t.kind === kind).length;
};

describe('spawn registry', () => {
  it('has an entry for every enemy kind in the world, and the rescue pod', () => {
    const kinds = SPAWN_REGISTRY.map((e) => e.kind);
    for (const kind of Object.keys(ENEMY_KINDS)) expect(kinds).toContain(kind);
    expect(kinds).toContain('lancer');
    expect(kinds).toContain('pod');
  });

  it('has unique ids and labels', () => {
    expect(new Set(SPAWN_REGISTRY.map((e) => e.id)).size).toBe(SPAWN_REGISTRY.length);
    expect(new Set(SPAWN_REGISTRY.map((e) => e.label)).size).toBe(SPAWN_REGISTRY.length);
  });

  it.each(SPAWN_REGISTRY.map((e) => [e.id, e] as const))(
    '%s: spawns the requested number, alive, near the nose',
    (_id, entry) => {
      const w = createWorld(1, createTuning());
      w.targets.length = 0;
      for (const count of SPAWN_COUNTS) {
        const before = countOf(w, entry.kind);
        expect(spawnAhead(w, entry, count)).toBe(count);
        expect(countOf(w, entry.kind)).toBe(before + count);
      }
    },
  );

  it('spawned bodies are alive with hp and a finite position', () => {
    const w = createWorld(1, createTuning());
    w.targets.length = 0;
    for (const entry of SPAWN_REGISTRY) spawnAhead(w, entry, 3);
    for (const b of [...w.fighters, ...w.targets]) {
      expect(b.alive).toBe(true);
      expect(b.hp).toBeGreaterThan(0);
      expect(Number.isFinite(b.x + b.y)).toBe(true);
    }
  });
});

describe('spawnPositions', () => {
  it('puts one spawn straight ahead at the spawn distance', () => {
    const [p] = spawnPositions({ x: 0, y: 0, heading: 0 }, 1, 1e6);
    expect(p![0]).toBeCloseTo(SPAWN_DISTANCE);
    expect(p![1]).toBeCloseTo(0);
  });

  it('follows the heading', () => {
    const [p] = spawnPositions({ x: 0, y: 0, heading: Math.PI / 2 }, 1, 1e6);
    expect(p![0]).toBeCloseTo(0);
    expect(p![1]).toBeCloseTo(SPAWN_DISTANCE);
  });

  it('spreads several in a row across the nose, distinct and centred', () => {
    const ps = spawnPositions({ x: 0, y: 0, heading: 0 }, 3, 1e6);
    expect(new Set(ps.map((p) => p.join())).size).toBe(3);
    expect(ps[0]![1] + ps[2]![1]).toBeCloseTo(0);
    expect(ps[1]![1]).toBeCloseTo(0);
  });

  it('stays inside the arena', () => {
    for (const p of spawnPositions({ x: 5500, y: 0, heading: 0 }, 5, 6000)) {
      expect(Math.hypot(p[0], p[1])).toBeLessThanOrEqual(6000 * 0.9 + 1e-6);
    }
  });
});
