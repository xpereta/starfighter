import { afterEach, describe, expect, it } from 'vitest';
import { qualityPresets } from '../../../data/quality';
import { styles } from '../../../data/styles';
import { createTuning } from '../../../data/tuning';
import type { GameEvent } from '../../core/events/events';
import { createRng } from '../../core/rng/rng';
import { createWorld } from '../../core/world/world';
import { polygonArea, MAX_PIECES, type DeathDef, type ShipKind } from '../style';
import { activeStyle, buildStyles, initStyle } from '../style-active';
import { createDeathFx } from './death-fx';
import {
  deathSeed,
  rollDeath,
  type BlastInit,
  type DeathContext,
  type DeathSink,
  type ExplosionInit,
  type PieceInit,
} from './death-roll';
import { drawExplosion, maxExplosionVertices } from './explosion-draw';
import { fracture, MIN_PIECE_SHARE } from './fracture';
import { createTriBatch } from './tri-batch';

afterEach(() => initStyle('', null));

const anime = buildStyles(styles)['anime-80s']!.pack;
const fighterShape = anime.ships.fighter!.polygon;
const fighterDeath = anime.deaths.fighter!;

const ctx: DeathContext = {
  x: 100,
  y: -40,
  heading: 0.7,
  radius: 28,
  vx: 120,
  vy: 30,
  blowX: 0.8,
  blowY: 0.6,
  impulse: 1,
};
const full = { pieceScale: 1, debrisLifeScale: 1 };

interface Rolled {
  pieces: PieceInit[];
  blasts: BlastInit[];
  explosions: ExplosionInit[];
  stops: number[];
}
function roll(def: DeathDef, seed: number, c = ctx, q = full, shape = fighterShape): Rolled {
  const out: Rolled = { pieces: [], blasts: [], explosions: [], stops: [] };
  const sink: DeathSink = {
    piece: (p) => out.pieces.push(p) - 1,
    blast: (b) => void out.blasts.push(b),
    explosion: (e) => void out.explosions.push(e),
    hitStop: (s) => void out.stops.push(s),
  };
  rollDeath(def, shape, c, q, createRng(seed), sink, 0);
  return out;
}

describe('fracture', () => {
  it('is deterministic for a seed and different for another', () => {
    const a = fracture(fighterShape, 6, createRng(5));
    const b = fracture(fighterShape, 6, createRng(5));
    const c = fracture(fighterShape, 6, createRng(6));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('covers the silhouette exactly with pieces that are not slivers', () => {
    const total = polygonArea(fighterShape);
    for (let seed = 1; seed <= 30; seed++) {
      const pieces = fracture(fighterShape, 7, createRng(seed));
      expect(pieces.length).toBeGreaterThanOrEqual(1);
      expect(pieces.length).toBeLessThanOrEqual(7);
      const sum = pieces.reduce((s, p) => s + polygonArea(p), 0);
      expect(sum).toBeCloseTo(total, 3);
      for (const p of pieces)
        expect(polygonArea(p)).toBeGreaterThanOrEqual(total * MIN_PIECE_SHARE - 1e-9);
    }
  });

  it('usually reaches the wanted count on a normal ship', () => {
    let reached = 0;
    for (let seed = 1; seed <= 30; seed++)
      if (fracture(fighterShape, 5, createRng(seed)).length === 5) reached++;
    expect(reached).toBeGreaterThan(20);
  });
});

describe('rollDeath', () => {
  it('rolls the same death for the same seed', () => {
    expect(roll(fighterDeath, 42)).toEqual(roll(fighterDeath, 42));
  });

  it('rolls a different death for another seed: pieces, delays and sizes differ', () => {
    const a = roll(fighterDeath, 1);
    const b = roll(fighterDeath, 2);
    expect(a.pieces.map((p) => p.points.length)).not.toEqual(b.pieces.map((p) => p.points.length));
    expect(a.blasts.map((x) => x.delay)).not.toEqual(b.blasts.map((x) => x.delay));
  });

  it('two kills of the same ship in different places have different seeds', () => {
    const seeds = new Set([
      deathSeed(7, 3, 100, 0, 0),
      deathSeed(7, 3, 100, 50, 0),
      deathSeed(7, 4, 100, 0, 0),
      deathSeed(7, 3, 101, 0, 0),
      deathSeed(8, 3, 100, 0, 0),
    ]);
    expect(seeds.size).toBe(5);
  });

  it('stays within the definition for many seeds', () => {
    for (const kind of Object.keys(anime.deaths) as ShipKind[]) {
      const def = anime.deaths[kind]!;
      for (let seed = 1; seed <= 40; seed++) {
        const r = roll(def, seed, ctx, full, anime.ships[kind]!.polygon);
        expect(r.pieces.length).toBeGreaterThanOrEqual(1);
        expect(r.pieces.length).toBeLessThanOrEqual(Math.min(MAX_PIECES, def.pieces[1]));
        const maxBlasts =
          def.secondary.reduce((s, g) => s + g.count[1], 0) + (def.finalBlast ? 1 : 0);
        expect(r.blasts.length).toBeLessThanOrEqual(maxBlasts);
        for (const p of r.pieces) {
          expect(p.life).toBeGreaterThanOrEqual(def.debris.life[0] - 1e-6);
          expect(p.life).toBeLessThanOrEqual(def.debris.life[1] + 1e-6);
          expect(Math.abs(p.spin)).toBeLessThanOrEqual(def.debris.spin + 1e-6);
        }
        for (const b of r.blasts) {
          expect(b.delay).toBeGreaterThanOrEqual(0);
          expect(b.size).toBeGreaterThan(0);
        }
        expect(r.explosions).toHaveLength(1); // the primary
      }
    }
  });

  it('pieces fly along the blow and keep the ship momentum', () => {
    let along = 0;
    let total = 0;
    for (let seed = 1; seed <= 40; seed++) {
      for (const p of roll(fighterDeath, seed).pieces) {
        total++;
        // Relative to the kept momentum, the blow direction dominates the average.
        const rx = p.vx - ctx.vx * fighterDeath.momentum;
        const ry = p.vy - ctx.vy * fighterDeath.momentum;
        if (rx * ctx.blowX + ry * ctx.blowY > 0) along++;
      }
    }
    expect(along / total).toBeGreaterThan(0.6);
  });

  it('the quality presets shrink the sequence: fewer pieces, shorter debris', () => {
    const high = roll(fighterDeath, 9, ctx, qualityPresets.high);
    const low = roll(fighterDeath, 9, ctx, qualityPresets.low);
    expect(low.pieces.length).toBeLessThanOrEqual(high.pieces.length);
    expect(Math.max(...low.pieces.map((p) => p.life))).toBeLessThan(
      Math.max(...high.pieces.map((p) => p.life)),
    );
  });

  it('a ship with a final blast closes with it, no earlier than the other blasts', () => {
    const r = roll(anime.deaths.turret!, 3, ctx, full, anime.ships.turret!.polygon);
    const last = r.blasts.filter((b) => b.last);
    expect(last).toHaveLength(1);
    expect(last[0]!.delay).toBeGreaterThanOrEqual(Math.max(...r.blasts.map((b) => b.delay)));
  });
});

describe('explosion drawing fits its budget', () => {
  it('no explosion kind writes more vertices than maxExplosionVertices', () => {
    for (const def of Object.values(anime.explosions)) {
      for (let t = 0; t <= 1; t += 0.05) {
        const batch = createTriBatch(maxExplosionVertices() * 2, 0);
        drawExplosion(batch, def, 0, 0, 50, t, 0.3, 0.2, 0.5, 0.7, 0.9);
        expect(batch.count).toBeLessThanOrEqual(maxExplosionVertices());
        batch.dispose();
      }
    }
  });
});

describe('death effects: pooled and capped', () => {
  const flashes: number[] = [];
  const stops: number[] = [];
  const hooks = {
    flash: (frames: number) => void flashes.push(frames),
    hitStop: (s: number) => void stops.push(s),
  };

  function kills(n: number, kind: 'fighter' | 'gunship' | 'turret' | 'wingman'): GameEvent[] {
    const events: GameEvent[] = [];
    for (let i = 0; i < n; i++)
      events.push({
        type: 'Killed',
        entityId: i,
        kind,
        x: (i % 10) * 90,
        y: Math.floor(i / 10) * 90,
        radius: 28,
      });
    return events;
  }

  for (const level of ['low', 'medium', 'high'] as const) {
    it(`never exceeds its caps on ${level} quality, however many ships die`, () => {
      initStyle('?style=anime-80s', null);
      const q = qualityPresets[level];
      const world = createWorld(5, createTuning());
      const fx = createDeathFx(q, world, hooks);
      for (let step = 0; step < 6; step++) {
        fx.consume(kills(40, step % 2 ? 'turret' : 'fighter'));
        for (let k = 0; k < 20; k++) {
          world.time += 1 / 60;
          fx.update(1 / 60);
          const s = fx.stats();
          expect(s.pieces).toBeLessThanOrEqual(q.pieceCap);
          expect(s.explosions).toBeLessThanOrEqual(q.explosionCap);
          expect(s.puffs).toBeLessThanOrEqual(q.puffCap);
        }
      }
      expect(fx.stats().pieces).toBeGreaterThan(0);
      // Everything dies out in the end: no leaks.
      for (let k = 0; k < 60 * 12; k++) fx.update(1 / 60);
      expect(fx.stats()).toMatchObject({ pieces: 0, blasts: 0, explosions: 0, puffs: 0 });
      fx.dispose();
    });
  }

  it('does nothing for kinds the style has no death for (plain keeps the shards)', () => {
    initStyle('?style=plain', null);
    const world = createWorld(5, createTuning());
    const fx = createDeathFx(qualityPresets.high, world, hooks);
    expect(fx.handles('fighter')).toBe(false);
    fx.consume(kills(5, 'fighter'));
    fx.update(1 / 60);
    expect(fx.stats()).toMatchObject({ pieces: 0, explosions: 0 });
    fx.dispose();
  });

  it('plain has a death sequence for the gunship: it breaks into pieces', () => {
    initStyle('?style=plain', null);
    const world = createWorld(5, createTuning());
    const fx = createDeathFx(qualityPresets.high, world, hooks);
    expect(fx.handles('gunship')).toBe(true);
    fx.consume(kills(1, 'gunship'));
    fx.update(1 / 60);
    expect(fx.stats().pieces).toBeGreaterThanOrEqual(6);
    for (let k = 0; k < 60 * 12; k++) fx.update(1 / 60);
    expect(fx.stats()).toMatchObject({ pieces: 0, blasts: 0, explosions: 0, puffs: 0 });
    fx.dispose();
  });

  it('the same world and kills roll the same death twice (replays repeat)', () => {
    initStyle('?style=anime-80s', null);
    const run = (): { pieces: number; explosions: number; blasts: number } => {
      const world = createWorld(11, createTuning());
      const fx = createDeathFx(qualityPresets.high, world, hooks);
      fx.consume(kills(3, 'fighter'));
      const s = fx.stats();
      fx.dispose();
      return { pieces: s.pieces, explosions: s.explosions, blasts: s.blasts };
    };
    expect(run()).toEqual(run());
  });

  it('asks for the screen effects of big blasts, and hit-stop on a death', () => {
    initStyle('?style=anime-80s', null);
    flashes.length = 0;
    stops.length = 0;
    const world = createWorld(5, createTuning());
    const fx = createDeathFx(qualityPresets.high, world, hooks);
    fx.consume(kills(1, 'turret'));
    expect(flashes.length).toBeGreaterThan(0);
    expect(stops).toContain(activeStyle().deaths.turret!.hitStop);
    fx.dispose();
  });
});
