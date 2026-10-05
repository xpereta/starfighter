import * as THREE from 'three';
import type { SpectacleQuality } from '../../../data/spectacle-quality';
import type { GameEvent } from '../../core/events/events';
import { clamp } from '../../core/math';
import { getLockable } from '../../core/world/lockable';
import type { World } from '../../core/world/world';
import { palette } from '../palette';
import { PLAYER_SCALE } from '../ship-art';
import type { ShipKind } from '../style';
import { activeStyle } from '../style-active';
import type { ShipFxDef } from '../spectacle-contract';
import { createGlowBatch, toLinear, type GlowBatch } from './glow-batch';
import { createRibbonSet, drawRibbon, type RibbonSet } from './ribbons';

/**
 * Ships with presence: engine plumes that follow the throttle (with a pulsing heat halo), wingtip
 * nav lights and a tail strobe, wingtip trails with a faint swept sheet between them, a helix
 * streak while the player rolls, missile smoke that spirals (the Macross swarm look), launch
 * flashes and lock-on brackets that snap onto locked targets. Render only: reads the world, fixed
 * pools, no allocation per frame.
 */

export interface ShipFxFrame {
  dt: number;
  time: number;
  /** 0..1 of the player's speed range. */
  speedFactor: number;
}

export interface ShipFxStats {
  plumes: number;
  ribbons: number;
  ribbonCap: number;
  launchFlashes: number;
  brackets: number;
}

export interface ShipFx {
  readonly object: THREE.Group;
  consume(events: readonly GameEvent[]): void;
  update(frame: ShipFxFrame, def: ShipFxDef, enabled: boolean): void;
  stats(): ShipFxStats;
  dispose(): void;
}

/** Ribbon keys: category * KEY_STRIDE + id. */
const KEY_STRIDE = 100000;
const CAT = { wingtip: 1, wingman: 2, fighter: 3, missile: 4, roll: 5, exhaust: 6 } as const;
/** Longest any ribbon point lives (s); each kind fades over its own shorter life. */
const MAX_LIFE = 3;
const PLUME_PLAYER = 0x8fdcff;
const PLUME_FIGHTER = 0xff9a50;
const SMOKE = 0xdfe9ff;
const FLAME = 0xffd9a0;
const LAUNCH_LIFE = 0.25;
const LAUNCH_CAP = 16;
const LOCK_TRACK_CAP = 16;
const BRACKET_SNAP = 14;
const NAV_SEGMENTS = 10;

const rgb = [0, 0, 0];
const colA = [0, 0, 0, 0];
const colB = [0, 0, 0, 0];

/** Wingtips of a shape: the points with the largest and smallest y (left is +y, nose along +x). */
export function wingtips(kind: ShipKind): { left: [number, number]; right: [number, number] } {
  const poly = activeStyle().ships[kind]?.polygon ?? [];
  let left: [number, number] = [-0.5, 0.8];
  let right: [number, number] = [-0.5, -0.8];
  let top = -Infinity;
  let bottom = Infinity;
  for (const [x, y] of poly) {
    if (y > top) {
      top = y;
      left = [x, y];
    }
    if (y < bottom) {
      bottom = y;
      right = [x, y];
    }
  }
  return { left, right };
}

const smooth = (a: number, b: number, x: number): number => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export function createShipFx(world: World, quality: SpectacleQuality): ShipFx {
  const group = new THREE.Group();
  const ribbons: RibbonSet = createRibbonSet(quality.ribbons, quality.ribbonPoints);
  const ribbonVerts = quality.ribbons * quality.ribbonPoints * 18;
  const glow: GlowBatch = createGlowBatch(6000 + ribbonVerts + LAUNCH_CAP * 400, 8, 'add', 0.55);
  const smoke: GlowBatch = createGlowBatch(ribbonVerts + 3000, 7, 'alpha', 0.54);
  group.add(smoke.mesh, glow.mesh);

  const launch = {
    x: new Float32Array(LAUNCH_CAP),
    y: new Float32Array(LAUNCH_CAP),
    a: new Float32Array(LAUNCH_CAP),
    age: new Float32Array(LAUNCH_CAP),
  };
  let launchCount = 0;
  const lockKey = new Int32Array(LOCK_TRACK_CAP).fill(-1);
  const lockTime = new Float32Array(LOCK_TRACK_CAP);
  let clock = 0;
  let plumes = 0;
  let exhaustThrust = 0;
  let bracketCount = 0;
  const wing = { left: [-0.5, 0.8] as [number, number], right: [-0.5, -0.8] as [number, number] };

  /** Plume, halo and nav lights for one ship; `scale` is its drawn size (u per shape unit). */
  function drawShip(
    kind: ShipKind,
    x: number,
    y: number,
    heading: number,
    scale: number,
    thrust: number,
    seed: number,
    plumeColor: number,
    def: ShipFxDef,
    time: number,
    lights: boolean,
  ): void {
    const shape = activeStyle().ships[kind];
    const c = Math.cos(heading);
    const s = Math.sin(heading);
    const p = def.plume;
    if (p.length > 0 && shape?.glow) {
      const level = p.idle + (1 - p.idle) * thrust;
      const flick =
        1 +
        p.flicker *
          0.14 *
          (Math.sin(time * 47 + seed * 5) * 0.5 + Math.sin(time * 31 + seed) * 0.5);
      const len = p.length * scale * level * flick;
      const width = p.width * scale;
      toLinear(plumeColor, rgb);
      for (const [gx, gy] of shape.glow) {
        const nx = x + scale * (gx * c - gy * s);
        const ny = y + scale * (gx * s + gy * c);
        const tx = nx - c * len;
        const ty = ny - s * len;
        // Outer flame: coloured, fading to nothing at the tip.
        colA[0] = rgb[0]! * 1.3;
        colA[1] = rgb[1]! * 1.3;
        colA[2] = rgb[2]! * 1.3;
        colA[3] = 0.6;
        colB[0] = rgb[0]!;
        colB[1] = rgb[1]!;
        colB[2] = rgb[2]!;
        colB[3] = 0;
        glow.streak(nx, ny, tx, ty, width, width * 0.1, colA, colB);
        // White-hot core, shorter.
        colA[0] = colA[1] = colA[2] = 2.2;
        colA[3] = 0.9;
        colB[0] = colB[1] = colB[2] = 1.4;
        colB[3] = 0;
        glow.streak(nx, ny, nx - c * len * 0.5, ny - s * len * 0.5, width * 0.45, 0, colA, colB);
        // Heat shimmer: a pulsing soft halo at the nozzle.
        if (p.shimmer > 0) {
          const pulse = 0.65 + 0.35 * Math.sin(time * 9 + seed * 3);
          colA[0] = rgb[0]! * 1.2;
          colA[1] = rgb[1]! * 1.2;
          colA[2] = rgb[2]! * 1.2;
          colA[3] = 0.2 * p.shimmer * pulse * level;
          colB[3] = 0;
          colB[0] = rgb[0]!;
          colB[1] = rgb[1]!;
          colB[2] = rgb[2]!;
          glow.disc(nx - c * width, ny - s * width, width * 2.4, 10, 0, colA, colB);
        }
        plumes++;
      }
    }
    if (lights && def.navLights.size > 0) {
      const size = def.navLights.size;
      const tips = [wing.left, wing.right];
      for (let k = 0; k < 2; k++) {
        const [lx, ly] = tips[k]!;
        const nx = x + scale * (lx * c - ly * s);
        const ny = y + scale * (lx * s + ly * c);
        toLinear(k === 0 ? def.navLights.port : def.navLights.starboard, rgb);
        const pulse = 0.75 + 0.25 * Math.sin(time * 3 + seed + k * 2);
        colA[0] = rgb[0]! * 2;
        colA[1] = rgb[1]! * 2;
        colA[2] = rgb[2]! * 2;
        colA[3] = 0.95 * pulse;
        colB[0] = rgb[0]!;
        colB[1] = rgb[1]!;
        colB[2] = rgb[2]!;
        colB[3] = 0;
        glow.disc(nx, ny, size * 0.45, NAV_SEGMENTS, 0, colA, colA);
        colA[3] = 0.4 * pulse;
        glow.disc(nx, ny, size * 1.8, NAV_SEGMENTS, 0, colA, colB);
      }
      // A white strobe on the tail: short sharp pulses.
      const hz = def.navLights.blinkHz;
      if (hz > 0) {
        const pulse = Math.pow(Math.max(0, Math.sin((time * hz + seed * 0.13) * Math.PI * 2)), 14);
        if (pulse > 0.02) {
          const tx = x - scale * 0.7 * c;
          const ty = y - scale * 0.7 * s;
          toLinear(def.navLights.strobe, rgb);
          colA[0] = rgb[0]! * 3;
          colA[1] = rgb[1]! * 3;
          colA[2] = rgb[2]! * 3;
          colA[3] = pulse;
          colB[0] = rgb[0]!;
          colB[1] = rgb[1]!;
          colB[2] = rgb[2]!;
          colB[3] = 0;
          glow.disc(tx, ty, size * 2.6, NAV_SEGMENTS, 0, colA, colB);
          glow.star(tx, ty, size * 4.5, size * 0.18, 0.4, colA, colB);
        }
      }
    }
  }

  /** The faint swept sheet between the two wingtip trails: quads aligned from the newest point back. */
  function drawSheet(left: number, right: number, alpha: number, life: number): void {
    if (left < 0 || right < 0) return;
    const n = Math.min(ribbons.count(left), ribbons.count(right));
    if (n < 2) return;
    const lc = ribbons.count(left);
    const rc = ribbons.count(right);
    const [r, g, b] = ribbons.color(left);
    for (let i = 0; i < n - 1; i++) {
      const li = lc - 1 - i;
      const ri = rc - 1 - i;
      const a0 = alpha * Math.max(0, 1 - ribbons.age(left, li) / life);
      const a1 = alpha * Math.max(0, 1 - ribbons.age(left, li - 1) / life);
      if (a0 < 0.004 && a1 < 0.004) continue;
      const lx0 = ribbons.x(left, li);
      const ly0 = ribbons.y(left, li);
      const rx0 = ribbons.x(right, ri);
      const ry0 = ribbons.y(right, ri);
      const lx1 = ribbons.x(left, li - 1);
      const ly1 = ribbons.y(left, li - 1);
      const rx1 = ribbons.x(right, ri - 1);
      const ry1 = ribbons.y(right, ri - 1);
      glow.tri(lx0, ly0, r, g, b, a0, rx0, ry0, r, g, b, a0, lx1, ly1, r, g, b, a1);
      glow.tri(rx0, ry0, r, g, b, a0, rx1, ry1, r, g, b, a1, lx1, ly1, r, g, b, a1);
    }
  }

  function drawBrackets(def: ShipFxDef, time: number): void {
    const { lockon } = world;
    bracketCount = 0;
    if (def.brackets.size <= 0) return;
    toLinear(def.brackets.color, rgb);
    const one = (id: number, snapAge: number, strength: number): void => {
      const body = getLockable(world, id);
      if (!body || !body.alive) return;
      const h =
        Math.max(26, body.radius * def.brackets.size) *
        (1 + 0.9 * Math.exp(-snapAge * BRACKET_SNAP));
      const rot = time * 0.7;
      const arm = h * 0.38;
      const w = 3 + h * 0.025;
      colA[0] = rgb[0]! * 1.5;
      colA[1] = rgb[1]! * 1.5;
      colA[2] = rgb[2]! * 1.5;
      colA[3] = strength;
      for (let k = 0; k < 4; k++) {
        const a = rot + k * (Math.PI / 2) + Math.PI / 4;
        const cx = body.x + Math.cos(a) * h * Math.SQRT2 * 0.5 * 1.0;
        const cy = body.y + Math.sin(a) * h * Math.SQRT2 * 0.5 * 1.0;
        // The two edges leaving the corner, pointing along the square's sides.
        const e1 = a + (3 * Math.PI) / 4;
        const e2 = a - (3 * Math.PI) / 4;
        glow.streak(cx, cy, cx + Math.cos(e1) * arm, cy + Math.sin(e1) * arm, w, w, colA, colA);
        glow.streak(cx, cy, cx + Math.cos(e2) * arm, cy + Math.sin(e2) * arm, w, w, colA, colA);
      }
      bracketCount++;
    };
    for (const id of lockon.locks) {
      let age = 10;
      for (let i = 0; i < LOCK_TRACK_CAP; i++) if (lockKey[i] === id) age = clock - lockTime[i]!;
      one(id, age, 0.95);
    }
    if (lockon.acquiringId >= 0) {
      const lt = world.tuning.lockon.lockTime || 1;
      const prog = clamp(lockon.progress / lt, 0, 1);
      one(lockon.acquiringId, 0, 0.25 + 0.5 * prog);
    }
  }

  return {
    object: group,
    consume(events) {
      for (const e of events) {
        if (e.type === 'MissileLaunched' && launchCount < LAUNCH_CAP) {
          const i = launchCount++;
          launch.x[i] = e.x;
          launch.y[i] = e.y;
          launch.a[i] = e.angle;
          launch.age[i] = 0;
        } else if (e.type === 'LockAcquired') {
          let slot = -1;
          for (let i = 0; i < LOCK_TRACK_CAP; i++) {
            if (lockKey[i] === e.targetId) {
              slot = i;
              break;
            }
            if (slot < 0 && lockKey[i] === -1) slot = i;
          }
          if (slot >= 0) {
            lockKey[slot] = e.targetId;
            lockTime[slot] = clock;
          }
        }
      }
    },
    update(f, def, enabled) {
      group.visible = enabled;
      if (!enabled) {
        ribbons.clear();
        launchCount = 0;
        return;
      }
      clock += f.dt;
      const { ship, tuning } = world;
      const flight = tuning.flight;
      const speedOf = (speed: number): number =>
        clamp((speed - flight.minSpeed) / (flight.maxSpeed - flight.minSpeed), 0, 1);
      glow.reset();
      smoke.reset();
      plumes = 0;
      const trailDef = def.trails;
      const missileDef = def.missiles;

      // Forget finished lock-ons.
      for (let i = 0; i < LOCK_TRACK_CAP; i++)
        if (lockKey[i] !== -1 && !world.lockon.locks.includes(lockKey[i]!)) lockKey[i] = -1;

      // Emit points (missiles and the player first: they win the slots when the pool is full).
      const m = world.missiles;
      toLinear(SMOKE, rgb);
      for (let i = 0; i < m.count; i++)
        ribbons.push(
          CAT.missile * KEY_STRIDE + m.data.uid[i]!,
          m.data.x[i]!,
          m.data.y[i]!,
          rgb[0]!,
          rgb[1]!,
          rgb[2]!,
        );
      const rolling = ship.evadeTimer > 0;
      if (rolling && def.rollStreak.length > 0) {
        toLinear(0xcfeeff, rgb);
        ribbons.push(CAT.roll * KEY_STRIDE, ship.x, ship.y, rgb[0]!, rgb[1]!, rgb[2]!);
      }
      // The player's exhaust: a ribbon from each nozzle along the path actually flown, so it curves with the turn.
      const exhaustLife = def.plume.trail ?? 0;
      const playerShape = activeStyle().ships.player;
      if (exhaustLife > 0 && playerShape?.glow) {
        const ec = Math.cos(ship.heading);
        const es = Math.sin(ship.heading);
        toLinear(PLUME_PLAYER, rgb);
        playerShape.glow.forEach(([gx, gy], k) => {
          ribbons.push(
            CAT.exhaust * KEY_STRIDE + k,
            ship.x + PLAYER_SCALE * (gx * ec - gy * es),
            ship.y + PLAYER_SCALE * (gx * es + gy * ec),
            rgb[0]!,
            rgb[1]!,
            rgb[2]!,
          );
        });
      }
      const w = wingtips('player');
      wing.left = w.left;
      wing.right = w.right;
      if (trailDef.width > 0) {
        const c = Math.cos(ship.heading);
        const s = Math.sin(ship.heading);
        toLinear(0xbfe8ff, rgb);
        const tips = [w.left, w.right];
        for (let k = 0; k < 2; k++) {
          const [lx, ly] = tips[k]!;
          ribbons.push(
            CAT.wingtip * KEY_STRIDE + k,
            ship.x + PLAYER_SCALE * (lx * c - ly * s),
            ship.y + PLAYER_SCALE * (lx * s + ly * c),
            rgb[0]!,
            rgb[1]!,
            rgb[2]!,
          );
        }
      }
      if (trailDef.width > 0) {
        toLinear(palette.wingman, rgb);
        world.squadron.wingmen.forEach((wm, i) => {
          if (wm.alive)
            ribbons.push(
              CAT.wingman * KEY_STRIDE + i,
              wm.ship.x - Math.cos(wm.ship.heading) * 20,
              wm.ship.y - Math.sin(wm.ship.heading) * 20,
              rgb[0]!,
              rgb[1]!,
              rgb[2]!,
            );
        });
        toLinear(PLUME_FIGHTER, rgb);
        world.fighters.forEach((fi, i) => {
          if (fi.alive)
            ribbons.push(
              CAT.fighter * KEY_STRIDE + i,
              fi.x - Math.cos(fi.ship.heading) * fi.radius * 0.6,
              fi.y - Math.sin(fi.ship.heading) * fi.radius * 0.6,
              rgb[0]!,
              rgb[1]!,
              rgb[2]!,
            );
        });
      }
      ribbons.step(f.dt, MAX_LIFE);

      // Plumes, nav lights.
      const throttle = world.actions.throttle;
      const playerThrust = clamp(0.3 + 0.7 * f.speedFactor + 0.35 * Math.max(0, throttle), 0, 1);
      exhaustThrust = playerThrust;
      drawShip(
        'player',
        ship.x,
        ship.y,
        ship.heading,
        PLAYER_SCALE,
        playerThrust,
        1,
        PLUME_PLAYER,
        def,
        f.time,
        true,
      );
      world.squadron.wingmen.forEach((wm, i) => {
        if (!wm.alive) return;
        drawShip(
          'wingman',
          wm.ship.x,
          wm.ship.y,
          wm.ship.heading,
          tuning.squadron.radius,
          clamp(0.3 + 0.7 * speedOf(wm.ship.speed), 0, 1),
          2 + i,
          palette.wingman,
          def,
          f.time,
          true,
        );
      });
      world.fighters.forEach((fi, i) => {
        if (!fi.alive) return;
        drawShip(
          'fighter',
          fi.x,
          fi.y,
          fi.ship.heading,
          fi.radius,
          clamp(0.35 + 0.65 * speedOf(fi.ship.speed), 0, 1),
          9 + i,
          PLUME_FIGHTER,
          def,
          f.time,
          false,
        );
      });

      // Trails.
      const trailFade = smooth(trailDef.from, Math.min(1, trailDef.from + 0.2), f.speedFactor);
      drawTrails(def, trailFade);

      // Missile flames and launch flashes.
      for (let i = 0; i < m.count; i++) {
        const mx = m.data.x[i]!;
        const my = m.data.y[i]!;
        const a = Math.atan2(m.data.vy[i]!, m.data.vx[i]!);
        toLinear(FLAME, rgb);
        colA[0] = rgb[0]! * 2;
        colA[1] = rgb[1]! * 2;
        colA[2] = rgb[2]! * 2;
        colA[3] = 0.9;
        colB[0] = rgb[0]!;
        colB[1] = rgb[1]!;
        colB[2] = rgb[2]!;
        colB[3] = 0;
        glow.streak(mx, my, mx - Math.cos(a) * 34, my - Math.sin(a) * 34, 9, 0, colA, colB);
      }
      for (let i = launchCount - 1; i >= 0; i--) {
        launch.age[i]! += f.dt;
        const t = launch.age[i]! / LAUNCH_LIFE;
        if (t >= 1 || missileDef.flash <= 0) {
          const last = --launchCount;
          if (i !== last) {
            launch.x[i] = launch.x[last]!;
            launch.y[i] = launch.y[last]!;
            launch.a[i] = launch.a[last]!;
            launch.age[i] = launch.age[last]!;
          }
          continue;
        }
        const k = 1 - t;
        const r = missileDef.flash * (0.35 + 0.9 * (1 - k * k));
        toLinear(FLAME, rgb);
        colA[0] = rgb[0]! * 2.4;
        colA[1] = rgb[1]! * 2.4;
        colA[2] = rgb[2]! * 2.4;
        colA[3] = 0.9 * k;
        colB[0] = rgb[0]!;
        colB[1] = rgb[1]!;
        colB[2] = rgb[2]!;
        colB[3] = 0;
        glow.disc(launch.x[i]!, launch.y[i]!, r, 12, 0, colA, colB);
        glow.star(launch.x[i]!, launch.y[i]!, r * 2.2, r * 0.12, launch.a[i]!, colA, colB);
        colA[3] = 0.6 * k;
        glow.ring(launch.x[i]!, launch.y[i]!, r * (1.1 + t), r * 0.08 * k, 24, colA, colB);
      }

      drawBrackets(def, f.time);
      glow.finish();
      smoke.finish();
    },
    stats: () => ({
      plumes,
      ribbons: ribbons.emitterCount(),
      ribbonCap: ribbons.maxEmitters,
      launchFlashes: launchCount,
      brackets: bracketCount,
    }),
    dispose() {
      glow.dispose();
      smoke.dispose();
      group.clear();
    },
  };

  function drawTrails(def: ShipFxDef, trailFade: number): void {
    const t = def.trails;
    const missileLife = def.missiles.smokeLife;
    const left = ribbons.slotOf(CAT.wingtip * KEY_STRIDE);
    const right = ribbons.slotOf(CAT.wingtip * KEY_STRIDE + 1);
    for (let k = 0; k < 2; k++) {
      const slot = k === 0 ? left : right;
      if (slot >= 0)
        drawRibbon(glow, ribbons, slot, {
          life: t.life,
          width: t.width,
          tailWidth: 0,
          alpha: t.alpha * trailFade,
          gain: 1.3,
        });
    }
    drawSheet(left, right, t.alpha * trailFade * 0.3, t.life);
    // The player's exhaust ribbons: longer with thrust, tapering to nothing, bent along the flown path.
    const exhaustLife = def.plume.trail ?? 0;
    if (exhaustLife > 0) {
      for (let k = 0; k < 4; k++) {
        const slot = ribbons.slotOf(CAT.exhaust * KEY_STRIDE + k);
        if (slot < 0) continue;
        drawRibbon(glow, ribbons, slot, {
          life: exhaustLife * (0.35 + 0.65 * exhaustThrust),
          width: def.plume.width * PLAYER_SCALE * 1.1,
          tailWidth: 0,
          alpha: 0.6,
          gain: 1.5,
        });
      }
    }
    const roll = ribbons.slotOf(CAT.roll * KEY_STRIDE);
    if (roll >= 0 && def.rollStreak.length > 0) {
      const life = clamp(def.rollStreak.length / Math.max(world.ship.speed, 150), 0.12, 1.2);
      drawRibbon(glow, ribbons, roll, {
        life,
        width: 3,
        tailWidth: 0.6,
        alpha: def.rollStreak.alpha,
        gain: 1.7,
        strands: 2,
        amplitude: PLAYER_SCALE * 0.6,
        turns: 2.4,
      });
    }
    ribbons.forEach((slot) => {
      const key = ribbons.keyOf(slot);
      const cat = Math.floor(key / KEY_STRIDE);
      const id = key - cat * KEY_STRIDE;
      if (cat === CAT.missile) {
        drawRibbon(smoke, ribbons, slot, {
          life: missileLife,
          width: 2.6,
          tailWidth: 7,
          alpha: 0.55,
          gain: 1,
          strands: def.missiles.spirals,
          amplitude: def.missiles.amplitude,
          turns: 1.5,
          phase: id * 1.7,
        });
      } else if (cat === CAT.wingman) {
        drawRibbon(glow, ribbons, slot, {
          life: t.life * 0.7,
          width: t.width * 0.6,
          tailWidth: 0,
          alpha: t.alpha * 0.45 * trailFade,
          gain: 1,
        });
      } else if (cat === CAT.fighter) {
        drawRibbon(glow, ribbons, slot, {
          life: t.life * 0.5,
          width: t.width * 0.5,
          tailWidth: 0,
          alpha: t.alpha * 0.5,
          gain: 1,
        });
      }
    });
  }
}
