import * as THREE from 'three';
import type { SpectacleQuality } from '../../../data/spectacle-quality';
import type { PartRole } from '../../core/enemies/capital-parts';
import type { EnemyKindId } from '../../core/enemies/kinds';
import type { GameEvent } from '../../core/events/events';
import { createRng, type Rng } from '../../core/rng/rng';
import type { World } from '../../core/world/world';
import { palette } from '../palette';
import {
  BLAST_KINDS,
  type BlastKind,
  type BlastRecipe,
  type CombatFxDef,
} from '../spectacle-contract';
import { createGlowBatch, toLinear, type GlowBatch } from './glow-batch';
import { spectacleSettings } from './settings';

/**
 * Spectacular combat effects layered over the style's own explosions: per kind of kill a flash
 * frame, shock rings, a banded fireball, sparks, smoke ink-blots, glinting debris and a chain
 * reaction of delayed little blasts (a capital-scale blast for turrets); hit sparks and missile
 * impacts; glowing bullet tracers and enemy plasma orbs. Render only: its own seeded stream and
 * fixed, capped pools; nothing here reaches the simulation.
 */

export interface CombatHooks {
  /** Zoom punch of the finished picture, 0..1. */
  punch(amount: number): void;
  /** Colour-fringe pulse, 0..1. */
  hit(amount: number): void;
}

export interface CombatFxStats {
  elements: number;
  sparks: number;
  blots: number;
  queued: number;
  caps: { elements: number; sparks: number; blots: number; queue: number };
}

export interface CombatFx {
  readonly object: THREE.Group;
  /** Feed each step's events; `def` is the active style's combat section. */
  consume(events: readonly GameEvent[], def: CombatFxDef): void;
  update(dt: number, def: CombatFxDef, enabled: boolean): void;
  stats(): CombatFxStats;
  dispose(): void;
}

const SEED = 0x1f83d9ab;
const INK = 0x241238;
const RECIPE_COUNT = BLAST_KINDS.length;
const MISSILE_RADIUS = 40;
const HIT_RADIUS = 18;
const DAMAGE_RADIUS = 60;
/** Element kinds. */
const FLASH = 0;
const RING = 1;
const FIREBALL = 2;
const SPARK = 0;
const GLINT = 1;
const FLASH_LIFE = 0.09;
const FIREBALL_LIFE = 0.6;
const RING_LIFE = 0.55;
const CHAIN_DELAY_MIN = 0.1;
/** The capital ship's last blast is drawn at this share of its hull radius (the recipe's sizes are in radii of that). */
const CAPITAL_BLAST_SHARE = 0.45;
/** Capital part blasts by role (x the part's radius): engines, the bridge and the core go off bigger. */
const PART_SCALE: Record<PartRole, number> = {
  turret: 1,
  armour: 1,
  engine: 1.3,
  bridge: 1.5,
  core: 2.2,
};
/** Sparks and glints never fly faster than a 160 u thing would throw them, so a capital blast does not empty the screen. */
const SPARK_RADIUS_CAP = 160;
/** Warp-in ring size (u) by enemy kind. */
const SPAWN_RING: Record<EnemyKindId, number> = {
  fighter: 70,
  lancer: 80,
  gunship: 110,
  capital: 520,
};
const ENEMY_MISSILE_RADIUS = 36;

const kindIndex = (k: BlastKind): number => BLAST_KINDS.indexOf(k);

const soft = [0, 0, 0, 0];
const hardA = [0, 0, 0, 0];
const hardB = [0, 0, 0, 0];

export function createCombatFx(
  world: World,
  quality: SpectacleQuality,
  hooks: CombatHooks,
): CombatFx {
  const group = new THREE.Group();
  const EC = quality.ringCap;
  const SC = quality.sparkCap;
  const KC = quality.blotCap;
  const QC = quality.queueCap;
  const rng: Rng = createRng((world.seed ^ SEED) >>> 0);

  const shotBudget = world.bullets.capacity * 12 + world.enemyShots.capacity * 36;
  const glow: GlowBatch = createGlowBatch(EC * 260 + SC * 12 + shotBudget + 600, 12, 'add', 0.7);
  const ink: GlowBatch = createGlowBatch(KC * 100 + 60, 11, 'alpha', 0.65);
  group.add(ink.mesh, glow.mesh);

  // Elements: flashes, rings and fireballs (swap-remove).
  const el = {
    x: new Float32Array(EC),
    y: new Float32Array(EC),
    age: new Float32Array(EC),
    life: new Float32Array(EC),
    size: new Float32Array(EC),
    rot: new Float32Array(EC),
  };
  const elKind = new Uint8Array(EC);
  const elRecipe = new Uint8Array(EC);
  let elCount = 0;
  // Sparks and glints.
  const sp = {
    x: new Float32Array(SC),
    y: new Float32Array(SC),
    vx: new Float32Array(SC),
    vy: new Float32Array(SC),
    age: new Float32Array(SC),
    life: new Float32Array(SC),
    size: new Float32Array(SC),
    phase: new Float32Array(SC),
  };
  const spKind = new Uint8Array(SC);
  const spRecipe = new Uint8Array(SC);
  let spCount = 0;
  // Ink blots.
  const bl = {
    x: new Float32Array(KC),
    y: new Float32Array(KC),
    vx: new Float32Array(KC),
    vy: new Float32Array(KC),
    age: new Float32Array(KC),
    life: new Float32Array(KC),
    size: new Float32Array(KC),
    seed: new Float32Array(KC),
  };
  let blCount = 0;
  // Delayed chain blasts.
  const q = {
    x: new Float32Array(QC),
    y: new Float32Array(QC),
    delay: new Float32Array(QC),
    size: new Float32Array(QC),
  };
  const qRecipe = new Uint8Array(QC);
  const qLast = new Uint8Array(QC);
  let qCount = 0;

  // Linear colour ramps per recipe: 3 colours x 3 channels.
  const ramps = new Float32Array(RECIPE_COUNT * 9);
  const writeRamps = (def: CombatFxDef): void => {
    currentTempo = def.tempo ?? 1;
    BLAST_KINDS.forEach((k, i) => {
      def.recipes[k].ramp.forEach((hex, j) => toLinear(hex, ramps, i * 9 + j * 3));
    });
  };
  const inkRgb = [0, 0, 0];
  const shotRgb = [0, 0, 0];
  const enemyRgb = [0, 0, 0];

  /** Time stretch of blasts from the pack (1 = original pace). */
  let currentTempo = 1;
  const tempo = (): number => currentTempo;

  function addElement(
    kind: number,
    ri: number,
    x: number,
    y: number,
    size: number,
    life: number,
  ): void {
    if (elCount >= EC) return;
    const i = elCount++;
    el.x[i] = x;
    el.y[i] = y;
    el.age[i] = 0;
    el.life[i] = life;
    el.size[i] = size;
    el.rot[i] = rng.range(0, Math.PI);
    elKind[i] = kind;
    elRecipe[i] = ri;
  }

  function addSpark(
    kind: number,
    ri: number,
    x: number,
    y: number,
    angle: number,
    speed: number,
    life: number,
    size: number,
  ): void {
    if (spCount >= SC) return;
    const i = spCount++;
    sp.x[i] = x;
    sp.y[i] = y;
    sp.vx[i] = Math.cos(angle) * speed;
    sp.vy[i] = Math.sin(angle) * speed;
    sp.age[i] = 0;
    sp.life[i] = life;
    sp.size[i] = size;
    sp.phase[i] = rng.range(0, 6.28);
    spKind[i] = kind;
    spRecipe[i] = ri;
  }

  function addBlot(x: number, y: number, angle: number, speed: number, size: number): void {
    if (blCount >= KC) return;
    const i = blCount++;
    bl.x[i] = x;
    bl.y[i] = y;
    bl.vx[i] = Math.cos(angle) * speed;
    bl.vy[i] = Math.sin(angle) * speed;
    bl.age[i] = 0;
    bl.life[i] = rng.range(1.3, 2.3) * tempo();
    bl.size[i] = size;
    bl.seed[i] = rng.range(0, 6.28);
  }

  function addQueued(
    x: number,
    y: number,
    delay: number,
    size: number,
    ri: number,
    last: boolean,
  ): void {
    if (qCount >= QC) return;
    const i = qCount++;
    q.x[i] = x;
    q.y[i] = y;
    q.delay[i] = delay;
    q.size[i] = size;
    qRecipe[i] = ri;
    qLast[i] = last ? 1 : 0;
  }

  /** A full blast at (x, y): `radius` is the size of the thing that died (u). */
  function blast(
    r: BlastRecipe,
    ri: number,
    x: number,
    y: number,
    radius: number,
    zoomScale = 1,
  ): void {
    const k = spectacleSettings.intensity;
    const flyRadius = Math.min(radius, SPARK_RADIUS_CAP);
    if (r.flash > 0) {
      addElement(FLASH, ri, x, y, r.flash * radius, FLASH_LIFE + 0.03 * Math.min(r.flash, 4));
    }
    for (let i = 0; i < r.rings; i++)
      addElement(
        RING,
        ri,
        x,
        y,
        r.ringSize * radius * (1 - 0.2 * i),
        (RING_LIFE + 0.12 * i) * tempo(),
      );
    if (r.fireball > 0)
      addElement(
        FIREBALL,
        ri,
        x,
        y,
        r.fireball * radius,
        FIREBALL_LIFE * (0.8 + 0.12 * Math.min(r.fireball, 4)) * tempo(),
      );
    const sparks = Math.round(r.sparks * Math.max(0.3, k));
    for (let i = 0; i < sparks; i++) {
      const speed = flyRadius * rng.range(4, 14) * (0.5 + 0.5 * rng.next());
      addSpark(
        SPARK,
        ri,
        x,
        y,
        rng.range(0, Math.PI * 2),
        speed,
        rng.range(0.35, 1.0) * tempo(),
        rng.range(0.8, 1.4),
      );
    }
    for (let i = 0; i < r.glints; i++)
      addSpark(
        GLINT,
        ri,
        x + rng.range(-0.5, 0.5) * radius,
        y + rng.range(-0.5, 0.5) * radius,
        rng.range(0, Math.PI * 2),
        flyRadius * rng.range(0.6, 3),
        rng.range(0.9, 2.1) * tempo(),
        rng.range(6, 13),
      );
    for (let i = 0; i < r.ink; i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = radius * rng.range(0.1, 0.8);
      addBlot(
        x + Math.cos(a) * d,
        y + Math.sin(a) * d,
        a,
        rng.range(10, 45),
        radius * rng.range(0.55, 1.1),
      );
    }
    for (let i = 0; i < r.chain; i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = radius * rng.range(0.1, 1.1);
      const last = i === r.chain - 1;
      addQueued(
        x + Math.cos(a) * d,
        y + Math.sin(a) * d,
        (last ? r.chainSpan + 0.25 : rng.range(CHAIN_DELAY_MIN, r.chainSpan)) * tempo(),
        radius * (last ? rng.range(1.1, 1.5) : rng.range(0.3, 0.6)),
        ri,
        last,
      );
    }
    if (r.zoom > 0) hooks.punch(r.zoom * k * zoomScale);
  }

  /** One little blast of a chain reaction (the last one is bigger, with a ring pair and a burst of sparks). */
  function miniBlast(ri: number, x: number, y: number, size: number, last: boolean): void {
    addElement(
      FIREBALL,
      ri,
      x,
      y,
      size * (last ? 1.9 : 1.4),
      FIREBALL_LIFE * (last ? 0.9 : 0.55) * tempo(),
    );
    addElement(FLASH, ri, x, y, size * (last ? 2.2 : 1), FLASH_LIFE * (last ? 1.4 : 0.7));
    addElement(RING, ri, x, y, size * (last ? 3.2 : 1.8), RING_LIFE * 0.8 * tempo());
    if (last) addElement(RING, ri, x, y, size * 2.2, RING_LIFE * tempo());
    const n = last ? 22 : 7;
    for (let i = 0; i < n; i++)
      addSpark(
        SPARK,
        ri,
        x,
        y,
        rng.range(0, Math.PI * 2),
        size * rng.range(3, 9),
        rng.range(0.3, 0.8),
        rng.range(0.7, 1.2),
      );
    if (last) {
      for (let i = 0; i < 3; i++)
        addBlot(x, y, rng.range(0, Math.PI * 2), rng.range(20, 60), size * rng.range(0.7, 1.2));
      hooks.punch(0.5);
    }
  }

  function hitSparks(
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    count: number,
    ri: number,
  ): void {
    // Thrown back along the way the shot came from, in a fan.
    const base = Math.atan2(-dirY, -dirX);
    for (let i = 0; i < count; i++)
      addSpark(
        SPARK,
        ri,
        x,
        y,
        base + rng.range(-1, 1),
        rng.range(180, 520),
        rng.range(0.15, 0.4),
        rng.range(0.7, 1.1),
      );
    addElement(FLASH, ri, x, y, HIT_RADIUS, 0.06);
  }

  function gradientDisc(
    x: number,
    y: number,
    r: number,
    c: ArrayLike<number>,
    gain: number,
    aIn: number,
    aOut: number,
  ): void {
    soft[0] = c[0]! * gain;
    soft[1] = c[1]! * gain;
    soft[2] = c[2]! * gain;
    soft[3] = aIn;
    hardA[0] = soft[0];
    hardA[1] = soft[1];
    hardA[2] = soft[2];
    hardA[3] = aOut;
    glow.disc(x, y, r, 14, 0, soft, hardA);
  }

  const col = [0, 0, 0];
  const rampAt = (ri: number, j: number, out: number[]): number[] => {
    out[0] = ramps[ri * 9 + j * 3]!;
    out[1] = ramps[ri * 9 + j * 3 + 1]!;
    out[2] = ramps[ri * 9 + j * 3 + 2]!;
    return out;
  };

  return {
    object: group,
    consume(events, def) {
      if (!spectacleSettings.combat) return;
      for (const e of events) {
        if (e.type === 'Killed') {
          const kind: BlastKind = e.kind;
          const ri = kindIndex(kind);
          blast(def.recipes[kind], ri, e.x, e.y, e.radius);
          // Capital-scale kills shake the colour channels too.
          hooks.hit(
            kind === 'turret' ? 0.9 : kind === 'wingman' ? 0.6 : kind === 'gunship' ? 0.5 : 0.25,
          );
        } else if (e.type === 'PartDestroyed') {
          // A capital-ship part: one punchy blast each, bigger for engines, the bridge and the core.
          const ri = kindIndex('capitalPart');
          const big = e.role === 'core' || e.role === 'bridge';
          blast(
            def.recipes.capitalPart,
            ri,
            e.x,
            e.y,
            e.radius * PART_SCALE[e.role],
            big ? 1 : 0.4,
          );
          hooks.hit(e.role === 'core' ? 0.9 : big ? 0.5 : 0.25);
        } else if (e.type === 'CoreExposed') {
          // The core is bare: a gold-white call ring and a flash that say "now".
          const ri = kindIndex('capitalPart');
          addElement(FLASH, ri, e.x, e.y, 150, 0.2);
          addElement(RING, ri, e.x, e.y, 340, 0.8 * tempo());
          addElement(RING, ri, e.x, e.y, 220, 0.6 * tempo());
          hooks.hit(0.4);
        } else if (e.type === 'CapitalDestroyed') {
          // The finale: the pack's biggest blast over the hull, a shock that reaches past the screen and a long colour fringe.
          blast(
            def.recipes.capital,
            kindIndex('capital'),
            e.x,
            e.y,
            e.radius * CAPITAL_BLAST_SHARE,
          );
          hooks.hit(1);
        } else if (e.type === 'EnemyMissileHit') {
          const ri = kindIndex('enemyMissile');
          const r = def.recipes.enemyMissile;
          if (e.hit === 'player') blast(r, ri, e.x, e.y, ENEMY_MISSILE_RADIUS);
          else blast(r, ri, e.x, e.y, ENEMY_MISSILE_RADIUS * 0.6, 0);
        } else if (e.type === 'EnemySpawned') {
          // A warp-in: a thin ring and a flash where it appears (a capital ship's is huge).
          const ri = kindIndex('hit');
          const size = SPAWN_RING[e.kind];
          addElement(FLASH, ri, e.x, e.y, size * 0.5, 0.12);
          addElement(RING, ri, e.x, e.y, size, 0.5 * tempo());
        } else if (e.type === 'WingBroken') {
          hooks.hit(0.2);
        } else if (e.type === 'Hit') {
          const missile = e.impulse >= world.tuning.missiles.missileHitImpulse;
          if (!missile)
            hitSparks(e.x, e.y, e.dirX, e.dirY, def.recipes.hit.sparks, kindIndex('hit'));
        } else if (e.type === 'MissileImpact') {
          blast(def.recipes.missile, kindIndex('missile'), e.x, e.y, MISSILE_RADIUS);
        } else if (e.type === 'PlayerDamaged') {
          hitSparks(e.x, e.y, 0, 1, Math.round(def.recipes.hit.sparks * 1.6), kindIndex('hit'));
          addElement(RING, kindIndex('hit'), e.x, e.y, DAMAGE_RADIUS, 0.35);
        }
      }
    },
    update(dt, def, enabled) {
      group.visible = enabled;
      if (!enabled) {
        elCount = spCount = blCount = qCount = 0;
        return;
      }
      writeRamps(def);

      // Delayed chain blasts.
      for (let i = qCount - 1; i >= 0; i--) {
        q.delay[i]! -= dt;
        if (q.delay[i]! > 0) continue;
        const x = q.x[i]!;
        const y = q.y[i]!;
        const size = q.size[i]!;
        const ri = qRecipe[i]!;
        const last = qLast[i] === 1;
        const lastIdx = --qCount;
        if (i !== lastIdx) {
          q.x[i] = q.x[lastIdx]!;
          q.y[i] = q.y[lastIdx]!;
          q.delay[i] = q.delay[lastIdx]!;
          q.size[i] = q.size[lastIdx]!;
          qRecipe[i] = qRecipe[lastIdx]!;
          qLast[i] = qLast[lastIdx]!;
        }
        miniBlast(ri, x, y, size, last);
      }

      glow.reset();
      ink.reset();

      // Ink blots first (under the glow).
      toLinear(INK, inkRgb);
      for (let i = blCount - 1; i >= 0; i--) {
        bl.age[i]! += dt;
        const t = bl.age[i]! / bl.life[i]!;
        if (t >= 1) {
          const last = --blCount;
          if (i !== last) for (const arr of Object.values(bl)) arr[i] = arr[last]!;
          continue;
        }
        const drag = Math.exp(-1.8 * dt);
        bl.vx[i]! *= drag;
        bl.vy[i]! *= drag;
        bl.x[i]! += bl.vx[i]! * dt;
        bl.y[i]! += bl.vy[i]! * dt;
        const grow = 1 - Math.pow(1 - Math.min(1, bl.age[i]! / 0.45), 3);
        const s = bl.size[i]! * (0.25 + 0.75 * grow);
        const a = t < 0.55 ? 0.8 : 0.8 * (1 - (t - 0.55) / 0.45);
        soft[0] = inkRgb[0]!;
        soft[1] = inkRgb[1]!;
        soft[2] = inkRgb[2]!;
        soft[3] = a;
        const sd = bl.seed[i]!;
        const x = bl.x[i]!;
        const y = bl.y[i]!;
        ink.disc(x, y, s, 10, 0, soft, soft);
        ink.disc(x + Math.cos(sd) * s * 0.7, y + Math.sin(sd) * s * 0.7, s * 0.6, 8, 0, soft, soft);
        ink.disc(
          x + Math.cos(sd + 2.4) * s * 0.65,
          y + Math.sin(sd + 2.4) * s * 0.65,
          s * 0.5,
          8,
          0,
          soft,
          soft,
        );
      }
      ink.finish();

      // Flashes, rings, fireballs.
      for (let i = elCount - 1; i >= 0; i--) {
        el.age[i]! += dt;
        const t = el.age[i]! / el.life[i]!;
        if (t >= 1) {
          const last = --elCount;
          if (i !== last) {
            for (const arr of Object.values(el)) arr[i] = arr[last]!;
            elKind[i] = elKind[last]!;
            elRecipe[i] = elRecipe[last]!;
          }
          continue;
        }
        const x = el.x[i]!;
        const y = el.y[i]!;
        const size = el.size[i]!;
        const ri = elRecipe[i]!;
        const kind = elKind[i]!;
        if (kind === FLASH) {
          // The flash frame: a hard white disc and a long four-point glint, gone in a few frames.
          const a = 1 - t;
          const r = size * (0.45 + 0.35 * t);
          hardA[0] = hardA[1] = hardA[2] = 1.5;
          hardA[3] = a * a;
          glow.disc(x, y, r, 14, el.rot[i]!, hardA, hardA);
          rampAt(ri, 1, col);
          soft[0] = col[0]! * 2.4;
          soft[1] = col[1]! * 2.4;
          soft[2] = col[2]! * 2.4;
          soft[3] = 0.9 * a;
          hardB[0] = col[0]!;
          hardB[1] = col[1]!;
          hardB[2] = col[2]!;
          hardB[3] = 0;
          glow.star(x, y, size * 2.6, size * 0.12, el.rot[i]!, soft, hardB);
        } else if (kind === RING) {
          const e = 1 - (1 - t) * (1 - t);
          const radius = size * (0.25 + 0.75 * e);
          rampAt(ri, 1, col);
          soft[0] = col[0]! * 1.8;
          soft[1] = col[1]! * 1.8;
          soft[2] = col[2]! * 1.8;
          soft[3] = 0.85 * (1 - t);
          hardB[0] = soft[0];
          hardB[1] = soft[1];
          hardB[2] = soft[2];
          hardB[3] = 0.1 * (1 - t);
          glow.ring(x, y, radius, Math.max(1.5, size * 0.1 * (1 - t)), 32, soft, hardB);
        } else {
          const grow = 1 - Math.pow(1 - Math.min(1, t * 2.2), 3);
          const shrink = t > 0.55 ? 1 - 0.45 * ((t - 0.55) / 0.45) : 1;
          const r = size * (0.3 + 0.7 * grow) * shrink;
          const a = Math.pow(1 - t, 1.2);
          // A soft glow, then two hard-edged cel layers: flame and hot core (the core shrinks first).
          gradientDisc(x, y, r * 1.35, rampAt(ri, 2, col), 1.1, 0.5 * a, 0);
          gradientDisc(x, y, r, rampAt(ri, 1, col), 1.5, 0.85 * a, 0.85 * a);
          const core = r * (0.62 - 0.55 * t);
          if (core > 0) gradientDisc(x, y, core, rampAt(ri, 0, col), 2.6, a, a);
        }
      }

      // Sparks and glints.
      const sparkDrag = Math.exp(-2.4 * dt);
      for (let i = spCount - 1; i >= 0; i--) {
        sp.age[i]! += dt;
        const t = sp.age[i]! / sp.life[i]!;
        if (t >= 1) {
          const last = --spCount;
          if (i !== last) {
            for (const arr of Object.values(sp)) arr[i] = arr[last]!;
            spKind[i] = spKind[last]!;
            spRecipe[i] = spRecipe[last]!;
          }
          continue;
        }
        const drag = spKind[i] === GLINT ? Math.exp(-0.9 * dt) : sparkDrag;
        sp.vx[i]! *= drag;
        sp.vy[i]! *= drag;
        sp.x[i]! += sp.vx[i]! * dt;
        sp.y[i]! += sp.vy[i]! * dt;
        const ri = spRecipe[i]!;
        const x = sp.x[i]!;
        const y = sp.y[i]!;
        if (spKind[i] === GLINT) {
          // Debris catching the light: a twinkling four-point star.
          const tw = 0.5 + 0.5 * Math.sin(sp.age[i]! * 22 + sp.phase[i]!);
          const a = (1 - t) * (0.35 + 0.65 * tw);
          rampAt(ri, 0, col);
          soft[0] = col[0]! * 2.4;
          soft[1] = col[1]! * 2.4;
          soft[2] = col[2]! * 2.4;
          soft[3] = a;
          hardB[0] = col[0]!;
          hardB[1] = col[1]!;
          hardB[2] = col[2]!;
          hardB[3] = 0;
          glow.star(
            x,
            y,
            sp.size[i]! * (0.6 + 0.8 * tw),
            sp.size[i]! * 0.09,
            sp.phase[i]!,
            soft,
            hardB,
          );
        } else {
          const heat = Math.min(1, t * 1.6);
          rampAt(ri, heat < 0.5 ? 0 : 1, col);
          soft[0] = col[0]! * 2.2;
          soft[1] = col[1]! * 2.2;
          soft[2] = col[2]! * 2.2;
          soft[3] = 1 - t;
          hardB[0] = col[0]!;
          hardB[1] = col[1]!;
          hardB[2] = col[2]!;
          hardB[3] = 0;
          const trail = 0.055;
          glow.streak(
            x - sp.vx[i]! * trail,
            y - sp.vy[i]! * trail,
            x,
            y,
            0.5 * sp.size[i]!,
            3 * sp.size[i]!,
            hardB,
            soft,
          );
        }
      }

      // Tracers: glowing streaks for player bullets, plasma orbs with a tail for enemy shots.
      if (quality.tracers > 0 && def.tracers.glow > 0) {
        const tr = def.tracers;
        toLinear(palette.projectile, shotRgb);
        const b = world.bullets;
        for (let i = 0; i < b.count; i++) {
          const x = b.data.x[i]!;
          const y = b.data.y[i]!;
          const vx = b.data.vx[i]!;
          const vy = b.data.vy[i]!;
          const sp2 = Math.hypot(vx, vy) || 1;
          const ux = vx / sp2;
          const uy = vy / sp2;
          const tx = x - ux * tr.length;
          const ty = y - uy * tr.length;
          soft[0] = shotRgb[0]! * tr.glow;
          soft[1] = shotRgb[1]! * tr.glow;
          soft[2] = shotRgb[2]! * tr.glow;
          soft[3] = 0.9;
          hardB[0] = shotRgb[0]!;
          hardB[1] = shotRgb[1]!;
          hardB[2] = shotRgb[2]!;
          hardB[3] = 0;
          glow.streak(x, y, tx, ty, tr.width * 2.2, 0, soft, hardB);
          hardA[0] = hardA[1] = hardA[2] = tr.glow * 1.6;
          hardA[3] = 1;
          glow.streak(
            x + ux * 6,
            y + uy * 6,
            x - ux * tr.length * 0.45,
            y - uy * tr.length * 0.45,
            tr.width * 0.7,
            0,
            hardA,
            hardB,
          );
        }
        if (tr.orb > 0) {
          toLinear(palette.enemyShot, enemyRgb);
          const s = world.enemyShots;
          for (let i = 0; i < s.count; i++) {
            const x = s.data.x[i]!;
            const y = s.data.y[i]!;
            const vx = s.data.vx[i]!;
            const vy = s.data.vy[i]!;
            const sp2 = Math.hypot(vx, vy) || 1;
            soft[0] = enemyRgb[0]! * tr.glow;
            soft[1] = enemyRgb[1]! * tr.glow;
            soft[2] = enemyRgb[2]! * tr.glow;
            soft[3] = 0.75;
            hardB[0] = enemyRgb[0]!;
            hardB[1] = enemyRgb[1]!;
            hardB[2] = enemyRgb[2]!;
            hardB[3] = 0;
            glow.disc(x, y, tr.orb * 1.5, 10, 0, soft, hardB);
            glow.streak(
              x,
              y,
              x - (vx / sp2) * tr.orb * 4,
              y - (vy / sp2) * tr.orb * 4,
              tr.orb * 1.1,
              0,
              soft,
              hardB,
            );
            hardA[0] = hardA[1] = hardA[2] = 2.4;
            hardA[3] = 1;
            glow.disc(x, y, tr.orb * 0.5, 8, 0, hardA, hardA);
          }
        }
      }
      glow.finish();
    },
    stats: () => ({
      elements: elCount,
      sparks: spCount,
      blots: blCount,
      queued: qCount,
      caps: { elements: EC, sparks: SC, blots: KC, queue: QC },
    }),
    dispose() {
      glow.dispose();
      ink.dispose();
      group.clear();
    },
  };
}
