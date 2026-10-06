import * as THREE from 'three';
import { CAPITAL_PARTS } from '../../../data/content/capital';
import type { PartRole } from '../../core/enemies/capital-parts';
import type { GameEvent } from '../../core/events/events';
import { createRng, type Rng } from '../../core/rng/rng';
import type { EntityKind } from '../../core/world/target';
import type { World } from '../../core/world/world';
import type { QualitySettings } from '../../../data/quality';
import { palette } from '../palette';
import { ringOutline } from '../shape-geometry';
import { pieceColor } from '../shape-parts';
import { EXPLOSION_KINDS, type ExplosionKind, type Point, type ShipKind } from '../style';
import { activeStyle } from '../style-active';
import {
  deathSeed,
  rollDeath,
  type DeathContext,
  type DeathSink,
  type PieceInit,
} from './death-roll';
import { MAX_PIECE_POINTS } from './fracture';
import { drawExplosion, maxExplosionVertices } from './explosion-draw';
import { createTriBatch, linearRgb, type TriBatch } from './tri-batch';

/** Pieces slow down like wreckage in thin air: share of speed lost per second. */
const PIECE_DRAG = 0.55;
/** A chained blast pushes its neighbour with this speed (u/s) and sets off its blast this soon (s). */
const CHAIN_KICK = 90;
const CHAIN_DELAY = 0.09;
/** Fresh wreckage is bright, then settles to this share of brightness within DIM_TIME so it never hides the fight. */
const DEBRIS_DIM = 0.55;
const DIM_TIME = 0.5;
/** The shadow tone of a piece (same as the ships). */
const SHADOW_TONE = 0.55;
/** Smoke puffs from burning pieces: life (s), start and end size as a share of the piece size, drift (u/s). */
const PUFF_LIFE = 0.7;
const PUFF_SIZE = [0.25, 0.55] as const;
const PUFF_DRIFT = 18;
const PUFF_SEGMENTS = 8;
/** A hit this fresh (s) and this close (radii) to a kill is taken as the killing blow. */
const BLOW_MAX_AGE = 0.35;
const BLOW_REACH = 2.5;
/** How close (u) a dead entity's recorded position must be to the event to be matched to it. */
const MATCH_DIST = 0.5;
/** Most blasts waiting to go off, per explosion in the pool. */
const BLASTS_PER_EXPLOSION = 2;
/** The start of the last (smoke) colour used for puffs when a style has no explosion to take it from. */
const FALLBACK_SMOKE = 0x2a2438;

const MAX_FILL_VERTS = 3 * MAX_PIECE_POINTS;
const MAX_OUTLINE_VERTS = 6 * MAX_PIECE_POINTS;

/** What the renderer wants to know about: screen effects asked for by a death. */
export interface DeathFxHooks {
  /** Frames of full-screen flash at 60 per second. */
  flash(frames: number, color: number): void;
  /** Drawing-only freeze, seconds. */
  hitStop(seconds: number): void;
}

export interface DeathFxStats {
  pieces: number;
  blasts: number;
  explosions: number;
  puffs: number;
  pieceCap: number;
  explosionCap: number;
  puffCap: number;
}

export interface DeathFx {
  readonly object: THREE.Group;
  /**
   * Rolls death sequences for `Killed` events whose kind has a death definition, and starts hit and
   * missile explosions for `Hit` events. Kinds without a definition are left to the simple shards
   * (see `handles`). Call once per simulation step.
   */
  consume(events: readonly GameEvent[]): void;
  /** True when the active style gives this kind a death sequence. */
  handles(kind: EntityKind): boolean;
  /** Advances and draws everything; `dt` is wall-clock seconds. */
  update(dt: number): void;
  stats(): DeathFxStats;
  dispose(): void;
}

const KIND_COLOR: Record<EntityKind, () => number> = {
  fighter: () => palette.fighter,
  gunship: () => palette.fighter,
  wingman: () => palette.wingman,
  static: () => palette.enemyStatic,
  drone: () => palette.enemy,
  turret: () => palette.turret,
};

/** Which ship shape and death a capital ship part uses, by role. */
const PART_SHIP_KIND: Record<PartRole, ShipKind> = {
  turret: 'capitalTurret',
  engine: 'capitalEngine',
  armour: 'capitalArmour',
  bridge: 'capitalBridge',
  core: 'capitalCore',
};
/** Death seeds of the capital ship use ids from here (part index added), clear of every entity id. */
const PART_ENTITY_BASE = 5000;
const partIndexOf = (id: string): number =>
  Math.max(
    0,
    CAPITAL_PARTS.findIndex((p) => p.id === id),
  );

const ink = [0, 0, 0];

/** Draws a piece's local triangles (x, y pairs, three vertices each) rotated by (c, s) and moved to (px, py). */
function drawLocal(
  batch: TriBatch,
  src: Float32Array,
  base: number,
  count: number,
  px: number,
  py: number,
  c: number,
  s: number,
  r: number,
  g: number,
  b: number,
): void {
  for (let k = 0; k < count; k += 3) {
    const o = base + k * 2;
    batch.tri(
      px + c * src[o]! - s * src[o + 1]!,
      py + s * src[o]! + c * src[o + 1]!,
      px + c * src[o + 2]! - s * src[o + 3]!,
      py + s * src[o + 2]! + c * src[o + 3]!,
      px + c * src[o + 4]! - s * src[o + 5]!,
      py + s * src[o + 4]! + c * src[o + 5]!,
      r,
      g,
      b,
    );
  }
}

const kindIndex = (k: ExplosionKind): number => EXPLOSION_KINDS.indexOf(k);

/** Pooled, capped death effects: flying pieces, delayed blasts, explosions and smoke. */
export function createDeathFx(
  quality: QualitySettings,
  world: World,
  hooks: DeathFxHooks,
): DeathFx {
  const group = new THREE.Group();

  // Pieces (stable slots: blasts refer to them).
  const PC = Math.max(0, Math.floor(quality.pieceCap));
  const pAlive = new Uint8Array(PC);
  const pGen = new Int32Array(PC);
  const pDeath = new Int32Array(PC);
  const pf = {
    x: new Float32Array(PC),
    y: new Float32Array(PC),
    vx: new Float32Array(PC),
    vy: new Float32Array(PC),
    rot: new Float32Array(PC),
    spin: new Float32Array(PC),
    size: new Float32Array(PC),
    age: new Float32Array(PC),
    life: new Float32Array(PC),
    fade: new Float32Array(PC),
    trail: new Float32Array(PC),
    acc: new Float32Array(PC),
    r: new Float32Array(PC),
    g: new Float32Array(PC),
    b: new Float32Array(PC),
  };
  const fillLocal = new Float32Array(PC * MAX_FILL_VERTS * 2);
  const fillCount = new Uint16Array(PC);
  const outLocal = new Float32Array(PC * MAX_OUTLINE_VERTS * 2);
  const outCount = new Uint16Array(PC);
  let pieceCount = 0;
  let generation = 0;

  // Blasts waiting to go off (stable slots).
  const BC = Math.max(8, Math.floor(quality.explosionCap) * BLASTS_PER_EXPLOSION);
  const bAlive = new Uint8Array(BC);
  const bKind = new Uint8Array(BC);
  const bFlags = new Uint8Array(BC); // bit 0 consume, bit 1 chain, bit 2 last
  const bPiece = new Int32Array(BC);
  const bGen = new Int32Array(BC);
  const bDeath = new Int32Array(BC);
  const bf = {
    delay: new Float32Array(BC),
    size: new Float32Array(BC),
    x: new Float32Array(BC),
    y: new Float32Array(BC),
  };
  let blastCount = 0;

  // Explosions (swap-remove: nothing refers to them).
  const EC = Math.max(0, Math.floor(quality.explosionCap));
  const ef = {
    x: new Float32Array(EC),
    y: new Float32Array(EC),
    vx: new Float32Array(EC),
    vy: new Float32Array(EC),
    age: new Float32Array(EC),
    size: new Float32Array(EC),
    rot: new Float32Array(EC),
    v0: new Float32Array(EC),
    v1: new Float32Array(EC),
    v2: new Float32Array(EC),
    v3: new Float32Array(EC),
  };
  const eKind = new Uint8Array(EC);
  const efArrays = Object.values(ef);
  let expCount = 0;

  // Smoke puffs (swap-remove).
  const SC = Math.max(0, Math.floor(quality.puffCap));
  const sf = {
    x: new Float32Array(SC),
    y: new Float32Array(SC),
    vx: new Float32Array(SC),
    vy: new Float32Array(SC),
    age: new Float32Array(SC),
    size: new Float32Array(SC),
  };
  const sfArrays = Object.values(sf);
  let puffCount = 0;

  // Drawing surfaces. Pieces and smoke first, explosions over them.
  const piecesBatch = createTriBatch(
    PC * (MAX_FILL_VERTS + MAX_OUTLINE_VERTS) + SC * PUFF_SEGMENTS * 3,
    5,
  );
  const blastBatch = createTriBatch(EC * maxExplosionVertices(), 10);
  group.add(piecesBatch.mesh, blastBatch.mesh);

  // Effects keep their own random streams, apart from the simulation's.
  const fxRng: Rng = createRng((world.seed ^ 0x5bd1e995) >>> 0);
  let deathCounter = 0;
  const lastHit = { x: 0, y: 0, dirX: 0, dirY: 0, impulse: 0, time: -1e9 };
  const tmpRgb = [0, 0, 0];

  const explosionDef = (k: ExplosionKind) => activeStyle().explosions[k];

  function spawnExplosion(
    kind: ExplosionKind,
    x: number,
    y: number,
    vx: number,
    vy: number,
    size: number,
    rot: number,
    v0: number,
    v1: number,
    v2: number,
    v3: number,
    flash: boolean,
  ): void {
    const def = explosionDef(kind);
    if (!def || expCount >= EC) return;
    const i = expCount++;
    ef.x[i] = x;
    ef.y[i] = y;
    ef.vx[i] = vx;
    ef.vy[i] = vy;
    ef.age[i] = 0;
    ef.size[i] = size;
    ef.rot[i] = rot;
    ef.v0[i] = v0;
    ef.v1[i] = v1;
    ef.v2[i] = v2;
    ef.v3[i] = v3;
    eKind[i] = kindIndex(kind);
    if (flash && def.flashFrames > 0) hooks.flash(def.flashFrames, def.ramp[0]!);
  }

  function spawnPuff(x: number, y: number, size: number): void {
    if (puffCount >= SC) return;
    const i = puffCount++;
    const a = fxRng.range(0, Math.PI * 2);
    sf.x[i] = x;
    sf.y[i] = y;
    sf.vx[i] = Math.cos(a) * PUFF_DRIFT;
    sf.vy[i] = Math.sin(a) * PUFF_DRIFT;
    sf.age[i] = 0;
    sf.size[i] = size;
  }

  function addPiece(p: PieceInit, colorHex: number): number {
    if (pieceCount >= PC) return -1;
    if (p.points.length > MAX_PIECE_POINTS) return -1;
    let slot = -1;
    for (let i = 0; i < PC; i++) {
      if (!pAlive[i]) {
        slot = i;
        break;
      }
    }
    if (slot < 0) return -1;
    const theme = activeStyle().theme;
    pAlive[slot] = 1;
    pGen[slot] = ++generation;
    pDeath[slot] = p.deathId;
    pieceCount++;
    pf.x[slot] = p.x;
    pf.y[slot] = p.y;
    pf.vx[slot] = p.vx;
    pf.vy[slot] = p.vy;
    pf.rot[slot] = p.rot;
    pf.spin[slot] = p.spin;
    pf.size[slot] = p.size;
    pf.age[slot] = 0;
    pf.life[slot] = Math.max(0.05, p.life);
    pf.fade[slot] = p.fade;
    pf.trail[slot] = p.trail;
    pf.acc[slot] = 0;
    linearRgb(colorHex, tmpRgb);
    const shaded = theme.shadowShare > 0 && p.localY < 0;
    const mul = shaded ? SHADOW_TONE : 1;
    pf.r[slot] = tmpRgb[0]! * mul;
    pf.g[slot] = tmpRgb[1]! * mul;
    pf.b[slot] = tmpRgb[2]! * mul;
    // Fan from the centroid: the pieces are cut from simple polygons, so a fan covers them.
    const n = p.points.length;
    let o = slot * MAX_FILL_VERTS * 2;
    let cnt = 0;
    for (let k = 0; k < n; k++) {
      const a = p.points[k]!;
      const b = p.points[(k + 1) % n]!;
      fillLocal[o++] = 0;
      fillLocal[o++] = 0;
      fillLocal[o++] = a[0];
      fillLocal[o++] = a[1];
      fillLocal[o++] = b[0];
      fillLocal[o++] = b[1];
      cnt += 3;
    }
    fillCount[slot] = Math.min(cnt, MAX_FILL_VERTS);
    let oc = 0;
    if (theme.outlineWidth > 0) {
      const tris = ringOutline(p.points as Point[], theme.outlineWidth / Math.max(p.size, 1e-6));
      let q = slot * MAX_OUTLINE_VERTS * 2;
      for (let k = 0; k < tris.length && oc < MAX_OUTLINE_VERTS; k += 3) {
        outLocal[q++] = tris[k]!;
        outLocal[q++] = tris[k + 1]!;
        oc++;
      }
    }
    outCount[slot] = oc - (oc % 3);
    return slot;
  }

  function removePiece(slot: number): void {
    if (!pAlive[slot]) return;
    pAlive[slot] = 0;
    pieceCount--;
  }

  function addBlast(b: Parameters<DeathSink['blast']>[0]): void {
    let slot = -1;
    for (let i = 0; i < BC; i++) {
      if (!bAlive[i]) {
        slot = i;
        break;
      }
    }
    if (slot < 0) return;
    bAlive[slot] = 1;
    blastCount++;
    bKind[slot] = kindIndex(b.kind);
    bFlags[slot] = (b.consume ? 1 : 0) | (b.chain ? 2 : 0) | (b.last ? 4 : 0);
    bPiece[slot] = b.piece;
    bGen[slot] = b.piece >= 0 ? pGen[b.piece]! : 0;
    bDeath[slot] = b.deathId;
    bf.delay[slot] = b.delay;
    bf.size[slot] = b.size;
    bf.x[slot] = b.x;
    bf.y[slot] = b.y;
  }

  function fireBlast(slot: number): void {
    const flags = bFlags[slot]!;
    const kind = EXPLOSION_KINDS[bKind[slot]!]!;
    const piece = bPiece[slot]!;
    const onPiece = piece >= 0 && pAlive[piece] === 1 && pGen[piece] === bGen[slot];
    const x = onPiece ? pf.x[piece]! : bf.x[slot]!;
    const y = onPiece ? pf.y[piece]! : bf.y[slot]!;
    spawnExplosion(
      kind,
      x,
      y,
      onPiece ? pf.vx[piece]! * 0.4 : 0,
      onPiece ? pf.vy[piece]! * 0.4 : 0,
      bf.size[slot]!,
      fxRng.range(0, Math.PI * 2),
      fxRng.next(),
      fxRng.next(),
      fxRng.next(),
      fxRng.next(),
      (flags & 4) !== 0,
    );
    if (onPiece && (flags & 2) !== 0) kickNeighbour(piece, x, y);
    if (onPiece && (flags & 1) !== 0) removePiece(piece);
  }

  /** A blast pushes the nearest other piece of the same death and sets off its blast early. */
  function kickNeighbour(from: number, x: number, y: number): void {
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < PC; i++) {
      if (!pAlive[i] || i === from || pDeath[i] !== pDeath[from]) continue;
      const d = Math.hypot(pf.x[i]! - x, pf.y[i]! - y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best < 0) return;
    const d = Math.max(bestD, 1e-6);
    pf.vx[best]! += ((pf.x[best]! - x) / d) * CHAIN_KICK;
    pf.vy[best]! += ((pf.y[best]! - y) / d) * CHAIN_KICK;
    for (let i = 0; i < BC; i++) {
      if (bAlive[i] && bPiece[i] === best && bGen[i] === pGen[best]) {
        bf.delay[i] = Math.min(bf.delay[i]!, CHAIN_DELAY);
        break;
      }
    }
  }

  /** Position, velocity and heading of the entity that just died, found in the world by position. */
  function findDying(
    kind: EntityKind,
    x: number,
    y: number,
  ): { vx: number; vy: number; heading: number } {
    const near = (ex: number, ey: number): boolean =>
      Math.abs(ex - x) < MATCH_DIST && Math.abs(ey - y) < MATCH_DIST;
    if (kind === 'fighter' || kind === 'gunship') {
      for (const f of world.fighters)
        if (near(f.x, f.y)) return { vx: f.ship.vx, vy: f.ship.vy, heading: f.ship.heading };
    } else if (kind === 'wingman') {
      for (const w of world.squadron.wingmen)
        if (near(w.ship.x, w.ship.y))
          return { vx: w.ship.vx, vy: w.ship.vy, heading: w.ship.heading };
    } else {
      for (const t of world.targets)
        if (t.kind === kind && near(t.x, t.y))
          return {
            vx: t.vx,
            vy: t.vy,
            heading: kind === 'drone' ? Math.atan2(t.vy, t.vx) : Math.PI / 2,
          };
    }
    return { vx: 0, vy: 0, heading: Math.PI / 2 };
  }

  /** Rolls one death sequence for `kind` at a place, with its own seeded stream (never the simulation's). */
  function rollFor(
    kind: ShipKind,
    entityId: number,
    x: number,
    y: number,
    radius: number,
    dying: { vx: number; vy: number; heading: number },
    color: number,
  ): void {
    const style = activeStyle();
    const def = style.deaths[kind];
    const shape = style.ships[kind];
    if (!def || !shape) return;
    const hit = lastHit;
    const fresh =
      world.time - hit.time <= BLOW_MAX_AGE &&
      Math.hypot(hit.x - x, hit.y - y) <= radius * BLOW_REACH;
    const ctx: DeathContext = {
      x,
      y,
      heading: dying.heading,
      radius,
      vx: dying.vx,
      vy: dying.vy,
      blowX: fresh ? hit.dirX : 0,
      blowY: fresh ? hit.dirY : 0,
      impulse: fresh ? hit.impulse : 0,
    };
    const rng = createRng(deathSeed(world.seed, entityId, world.tick, x, y));
    const sink: DeathSink = {
      // Pieces are cut along the outer silhouette; the layered parts under a piece's centre colour it.
      piece: (p) =>
        addPiece(p, pieceColor(shape, p.localX, p.localY, color, style.theme.partColors)),
      blast: addBlast,
      explosion: (x) =>
        spawnExplosion(
          x.kind,
          x.x,
          x.y,
          x.vx,
          x.vy,
          x.size,
          x.rot,
          x.v0,
          x.v1,
          x.v2,
          x.v3,
          x.flash,
        ),
      hitStop: (s) => {
        if (s > 0) hooks.hitStop(s);
      },
    };
    rollDeath(def, shape.polygon, ctx, quality, rng, sink, deathCounter++);
  }

  function startDeath(e: Extract<GameEvent, { type: 'Killed' }>): void {
    if (!activeStyle().deaths[e.kind] || !activeStyle().ships[e.kind]) return;
    rollFor(
      e.kind,
      e.entityId,
      e.x,
      e.y,
      e.radius,
      findDying(e.kind, e.x, e.y),
      KIND_COLOR[e.kind](),
    );
  }

  /** The capital ship's parts and hull die from the same data as any ship (prototype 5, track C). */
  function startCapitalDeath(
    kind: ShipKind,
    entityId: number,
    x: number,
    y: number,
    radius: number,
  ): void {
    const cap = world.enemies.capital;
    rollFor(
      kind,
      entityId,
      x,
      y,
      radius,
      { vx: cap?.vx ?? 0, vy: cap?.vy ?? 0, heading: cap?.heading ?? 0 },
      kind === 'capitalTurret' ? palette.turret : palette.enemy,
    );
  }

  const smokeRgb = new Float32Array(3);
  function smokeColor(): Float32Array {
    const ex = activeStyle().explosions;
    const def = ex.large ?? ex.small ?? ex.heavy;
    linearRgb(def ? def.ramp[def.ramp.length - 1]! : FALLBACK_SMOKE, smokeRgb);
    return smokeRgb;
  }

  return {
    object: group,
    handles(kind) {
      return activeStyle().deaths[kind] !== undefined;
    },
    consume(events) {
      const missileImpulse = world.tuning.missiles.missileHitImpulse;
      for (const e of events) {
        if (e.type === 'Hit') {
          lastHit.x = e.x;
          lastHit.y = e.y;
          lastHit.dirX = e.dirX;
          lastHit.dirY = e.dirY;
          lastHit.impulse = e.impulse;
          lastHit.time = world.time;
          const kind: ExplosionKind = e.impulse >= missileImpulse ? 'missile' : 'hitSpark';
          const def = explosionDef(kind);
          if (def)
            spawnExplosion(
              kind,
              e.x,
              e.y,
              0,
              0,
              def.size,
              fxRng.range(0, Math.PI * 2),
              fxRng.next(),
              fxRng.next(),
              fxRng.next(),
              fxRng.next(),
              false,
            );
        } else if (e.type === 'Killed') startDeath(e);
        else if (e.type === 'PartDestroyed')
          startCapitalDeath(
            PART_SHIP_KIND[e.role],
            PART_ENTITY_BASE + partIndexOf(e.part),
            e.x,
            e.y,
            e.radius,
          );
        else if (e.type === 'CapitalDestroyed')
          startCapitalDeath('capital', PART_ENTITY_BASE - 1, e.x, e.y, e.radius);
      }
    },
    update(dt) {
      const styleExplosions = activeStyle().explosions;
      const theme = activeStyle().theme;

      // Blasts waiting to go off.
      for (let i = 0; i < BC; i++) {
        if (!bAlive[i]) continue;
        const piece = bPiece[i]!;
        if (piece >= 0 && pAlive[piece] === 1 && pGen[piece] === bGen[i]) {
          bf.x[i] = pf.x[piece]!;
          bf.y[i] = pf.y[piece]!;
        }
        bf.delay[i]! -= dt;
        if (bf.delay[i]! <= 0) {
          bAlive[i] = 0;
          blastCount--;
          fireBlast(i);
        }
      }

      // Pieces fly, spin, trail smoke and fade.
      const drag = Math.exp(-PIECE_DRAG * dt);
      for (let i = 0; i < PC; i++) {
        if (!pAlive[i]) continue;
        pf.age[i]! += dt;
        if (pf.age[i]! >= pf.life[i]!) {
          removePiece(i);
          continue;
        }
        pf.x[i]! += pf.vx[i]! * dt;
        pf.y[i]! += pf.vy[i]! * dt;
        pf.vx[i]! *= drag;
        pf.vy[i]! *= drag;
        pf.rot[i]! += pf.spin[i]! * dt;
        if (pf.trail[i]! > 0) {
          pf.acc[i]! += pf.trail[i]! * dt;
          while (pf.acc[i]! >= 1) {
            pf.acc[i]! -= 1;
            spawnPuff(pf.x[i]!, pf.y[i]!, pf.size[i]!);
          }
        }
      }

      // Explosions and puffs age.
      for (let i = expCount - 1; i >= 0; i--) {
        const def = styleExplosions[EXPLOSION_KINDS[eKind[i]!]!];
        ef.age[i]! += dt;
        if (!def || ef.age[i]! >= def.duration) {
          removeExplosion(i);
          continue;
        }
        ef.x[i]! += ef.vx[i]! * dt;
        ef.y[i]! += ef.vy[i]! * dt;
      }
      for (let i = puffCount - 1; i >= 0; i--) {
        sf.age[i]! += dt;
        if (sf.age[i]! >= PUFF_LIFE) {
          removePuff(i);
          continue;
        }
        sf.x[i]! += sf.vx[i]! * dt;
        sf.y[i]! += sf.vy[i]! * dt;
      }

      // Draw: smoke, then pieces (outline under fill), then the explosions.
      piecesBatch.reset();
      const smoke = smokeColor();
      for (let i = 0; i < puffCount; i++) {
        const t = sf.age[i]! / PUFF_LIFE;
        const r = sf.size[i]! * (PUFF_SIZE[0] + (PUFF_SIZE[1] - PUFF_SIZE[0]) * t);
        const m = (1 - t) * DEBRIS_DIM;
        piecesBatch.disc(
          sf.x[i]!,
          sf.y[i]!,
          r,
          PUFF_SEGMENTS,
          0,
          smoke[0]! * m,
          smoke[1]! * m,
          smoke[2]! * m,
        );
      }
      linearRgb(theme.outlineColor, ink);
      for (let i = 0; i < PC; i++) {
        if (!pAlive[i]) continue;
        const age = pf.age[i]!;
        const life = pf.life[i]!;
        const fadeSpan = life * pf.fade[i]!;
        const fade = fadeSpan > 0 ? Math.min(1, (life - age) / fadeSpan) : 1;
        const dim = 1 - (1 - DEBRIS_DIM) * Math.min(1, age / DIM_TIME);
        const m = fade * dim;
        const c = Math.cos(pf.rot[i]!) * pf.size[i]!;
        const s = Math.sin(pf.rot[i]!) * pf.size[i]!;
        const px = pf.x[i]!;
        const py = pf.y[i]!;
        const base = i * MAX_OUTLINE_VERTS * 2;
        drawLocal(
          piecesBatch,
          outLocal,
          base,
          outCount[i]!,
          px,
          py,
          c,
          s,
          ink[0]! * m,
          ink[1]! * m,
          ink[2]! * m,
        );
        const fbase = i * MAX_FILL_VERTS * 2;
        drawLocal(
          piecesBatch,
          fillLocal,
          fbase,
          fillCount[i]!,
          px,
          py,
          c,
          s,
          pf.r[i]! * m,
          pf.g[i]! * m,
          pf.b[i]! * m,
        );
      }
      piecesBatch.finish();

      blastBatch.reset();
      for (let i = 0; i < expCount; i++) {
        const def = styleExplosions[EXPLOSION_KINDS[eKind[i]!]!]!;
        drawExplosion(
          blastBatch,
          def,
          ef.x[i]!,
          ef.y[i]!,
          ef.size[i]!,
          ef.age[i]! / def.duration,
          ef.rot[i]!,
          ef.v0[i]!,
          ef.v1[i]!,
          ef.v2[i]!,
          ef.v3[i]!,
        );
      }
      blastBatch.finish();
    },
    stats() {
      return {
        pieces: pieceCount,
        blasts: blastCount,
        explosions: expCount,
        puffs: puffCount,
        pieceCap: PC,
        explosionCap: EC,
        puffCap: SC,
      };
    },
    dispose() {
      piecesBatch.dispose();
      blastBatch.dispose();
    },
  };

  function removeExplosion(i: number): void {
    const last = expCount - 1;
    if (i !== last) {
      for (const arr of efArrays) arr[i] = arr[last]!;
      eKind[i] = eKind[last]!;
    }
    expCount = last;
  }

  function removePuff(i: number): void {
    const last = puffCount - 1;
    if (i !== last) for (const arr of sfArrays) arr[i] = arr[last]!;
    puffCount = last;
  }
}
