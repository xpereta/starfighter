import type { Rng } from '../../core/rng/rng';
import type { DeathDef, ExplosionKind, Point } from '../style';
import { MAX_PIECES } from '../style';
import { fracture, polygonCentroid } from './fracture';

/** Hit impulse at which the killing blow counts as a full-strength kick (a missile hit). */
export const BLOW_IMPULSE_REF = 3;
/** Wreck blasts go off inside this share of the ship's radius around where it died. */
const WRECK_SPREAD = 0.8;

/** Everything the roll needs to know about the ship that died and the blow that killed it. */
export interface DeathContext {
  x: number;
  y: number;
  /** Where the nose pointed, radians (the silhouette is authored nose along +x). */
  heading: number;
  /** Drawn size: world units per shape unit. */
  radius: number;
  vx: number;
  vy: number;
  /** Unit direction of the killing blow, or 0, 0 when unknown. */
  blowX: number;
  blowY: number;
  /** Impulse of the killing hit (0 when unknown). */
  impulse: number;
}

/** The quality presets' say in the roll. */
export interface RollQuality {
  /** Share of the asked-for pieces that appear, 0..1. */
  pieceScale: number;
  /** Multiplier on how long pieces linger. */
  debrisLifeScale: number;
}

export interface PieceInit {
  deathId: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Heading of the piece at the start, radians; size is world units per shape unit. */
  rot: number;
  spin: number;
  size: number;
  /** Seconds it lingers. */
  life: number;
  /** Share of its life spent fading, 0..1. */
  fade: number;
  /** Smoke puffs per second. */
  trail: number;
  /** Outline points around the piece's own centroid, in shape units. */
  points: Point[];
  /** Where the centroid was in the ship's own frame (shape units): decides its shading. */
  localX: number;
  localY: number;
}

export interface BlastInit {
  deathId: number;
  kind: ExplosionKind;
  /** Seconds until it goes off. */
  delay: number;
  /** World units. */
  size: number;
  /** Slot of the piece it rides on, or -1 for the wreck (then x, y are where it goes off). */
  piece: number;
  x: number;
  y: number;
  /** Destroys its piece when it goes off. */
  consume: boolean;
  /** Kicks a neighbouring piece into an early blast. */
  chain: boolean;
  /** The closing blast of the sequence (may flash the screen). */
  last: boolean;
}

export interface ExplosionInit {
  kind: ExplosionKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** World units. */
  size: number;
  rot: number;
  /** Four rolled numbers 0..1 that vary the shape of this blast. */
  v0: number;
  v1: number;
  v2: number;
  v3: number;
  /** The first or last blast of a death: may flash the screen. */
  flash: boolean;
}

/** Where a rolled death goes: the effects pools. A test sink just records. */
export interface DeathSink {
  /** Adds a piece; returns its slot, or -1 when the pool is full. */
  piece(p: PieceInit): number;
  blast(b: BlastInit): void;
  explosion(e: ExplosionInit): void;
  /** Drawing-only freeze, seconds (0 = none). */
  hitStop(seconds: number): void;
}

/** A death's own seed: the world seed and what the event says, mixed. Never the simulation's stream. */
export function deathSeed(
  worldSeed: number,
  entityId: number,
  tick: number,
  x: number,
  y: number,
): number {
  let h = Math.imul(worldSeed ^ 0x9e3779b9, 0x85ebca6b);
  for (const v of [entityId, tick, Math.round(x), Math.round(y)]) {
    h = Math.imul(h ^ (v | 0), 0xc2b2ae35);
    h ^= h >>> 15;
  }
  return h >>> 0;
}

const rotate = (x: number, y: number, a: number): Point => [
  Math.cos(a) * x - Math.sin(a) * y,
  Math.sin(a) * x + Math.cos(a) * y,
];

const pick = (r: readonly [number, number], rng: Rng): number => rng.range(r[0], r[1]);

/**
 * Rolls one death sequence from its definition: the fracture of the silhouette, the pieces'
 * flight, the primary and delayed explosions. Every random number comes from `rng` in a fixed
 * order, so the same inputs give the same death and different inputs give a different one.
 */
export function rollDeath(
  def: DeathDef,
  shape: readonly Point[],
  ctx: DeathContext,
  quality: RollQuality,
  rng: Rng,
  sink: DeathSink,
  deathId: number,
): void {
  const unit = ctx.radius;
  const hasBlow = ctx.blowX !== 0 || ctx.blowY !== 0;
  const kick = hasBlow ? def.blow * (0.6 + 0.4 * Math.min(1, ctx.impulse / BLOW_IMPULSE_REF)) : 0;
  const keepVx = ctx.vx * def.momentum;
  const keepVy = ctx.vy * def.momentum;

  // Primary blast, on the spot.
  sink.explosion({
    kind: def.primary.kind,
    x: ctx.x,
    y: ctx.y,
    vx: keepVx,
    vy: keepVy,
    size: def.primary.size * unit,
    rot: rng.range(0, Math.PI * 2),
    v0: rng.next(),
    v1: rng.next(),
    v2: rng.next(),
    v3: rng.next(),
    flash: true,
  });
  sink.hitStop(def.hitStop);

  // Pieces, cut from the ship's own silhouette.
  const want = Math.max(
    1,
    Math.min(MAX_PIECES, Math.round(pick(def.pieces, rng) * quality.pieceScale)),
  );
  const cuts = fracture(shape, want, rng);
  const slots: number[] = [];
  for (const cut of cuts) {
    const [cx, cy] = polygonCentroid(cut);
    const [ox, oy] = rotate(cx * unit, cy * unit, ctx.heading);
    const dist = Math.hypot(ox, oy);
    const radial = dist > 1e-6 ? Math.atan2(oy, ox) : rng.range(0, Math.PI * 2);
    // Scatter strays the piece from flying straight out (no extra random draw when it is 0, so old styles roll the same).
    const scatter = def.debris.scatter ?? 0;
    const away = scatter > 0 ? radial + (rng.next() * 2 - 1) * Math.PI * scatter : radial;
    const speed = pick(def.debris.drift, rng);
    const jitter = rng.next();
    const spin = (rng.next() * 2 - 1) * def.debris.spin;
    const life = pick(def.debris.life, rng) * quality.debrisLifeScale;
    const outX = Math.cos(away);
    const outY = Math.sin(away);
    const blowSpeed = speed * (0.7 + 0.6 * jitter);
    const slot = sink.piece({
      deathId,
      x: ctx.x + ox,
      y: ctx.y + oy,
      vx: outX * speed * (1 - kick) + ctx.blowX * blowSpeed * kick + keepVx,
      vy: outY * speed * (1 - kick) + ctx.blowY * blowSpeed * kick + keepVy,
      rot: ctx.heading,
      spin,
      size: unit,
      life,
      fade: def.debris.fade,
      trail: def.debris.trail,
      points: cut.map(([x, y]) => [x - cx, y - cy] as Point),
      localX: cx,
      localY: cy,
    });
    if (slot >= 0) slots.push(slot);
  }

  // Delayed explosions: on pieces or on the wreck.
  let lastDelay = 0;
  for (const group of def.secondary) {
    const n = Math.round(pick(group.count, rng));
    for (let i = 0; i < n; i++) {
      const delay = pick(group.delay, rng);
      const size = pick(group.size, rng) * unit;
      const target = rng.int(Math.max(1, slots.length));
      const consume = rng.next() < group.consume;
      const chain = rng.next() < group.chain;
      const angle = rng.range(0, Math.PI * 2);
      const reach = Math.sqrt(rng.next()) * WRECK_SPREAD * unit;
      const onPiece = group.attach === 'piece' && slots.length > 0;
      sink.blast({
        deathId,
        kind: group.kind,
        delay,
        size,
        piece: onPiece ? slots[target]! : -1,
        x: ctx.x + Math.cos(angle) * reach + keepVx * delay,
        y: ctx.y + Math.sin(angle) * reach + keepVy * delay,
        consume: onPiece && consume,
        chain,
        last: false,
      });
      lastDelay = Math.max(lastDelay, delay);
    }
  }

  // The closing blast.
  if (def.finalBlast) {
    const f = def.finalBlast;
    sink.blast({
      deathId,
      kind: f.kind,
      delay: Math.max(f.delay, lastDelay),
      size: f.size * unit,
      piece: -1,
      x: ctx.x + keepVx * f.delay,
      y: ctx.y + keepVy * f.delay,
      consume: false,
      chain: false,
      last: true,
    });
  }
}
