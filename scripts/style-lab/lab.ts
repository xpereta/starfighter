/**
 * The style lab: a headless-friendly page that draws the style packs with the game's own render
 * code (ships, backdrop, bullets) and exposes `window.lab` to the scripts in `scripts/`:
 * `style-sheet.mjs` (a reference sheet of every ship of a pack, large, on its own backdrop),
 * `contrast-audit.mjs` (luminance contrast of everything against the backdrop) and
 * `frame-time.mjs` (the cost of many layered ships). Serve it with Vite (`vite` in dev mode).
 */
import * as THREE from 'three';
import { cameraParams } from '../../data/tuning/camera';
import { createBackground, type Background } from '../../src/render/background';
import { createBulletRenderer, type BulletRenderer } from '../../src/render/bullets';
import {
  ENTITY_RATIO_TARGET,
  TEXT_RATIO_TARGET,
  contrastRatio,
  luminanceOfHex,
  luminancePercentile,
  measureEntity,
  type EntityContrast,
} from '../../src/render/contrast';
import { palette } from '../../src/render/palette';
import { createShipArt, type ShipArt } from '../../src/render/ship-art';
import { SHAPE_KINDS, shapeTriangles, type ShapeKind } from '../../src/render/style';
import { initStyle, peekStyle, activeStyle, styleIds } from '../../src/render/style-active';

initStyle('?style=plain', null);

interface EntityInfo {
  color: () => number;
  /** Drawn radius in the game, world units. */
  radius: number;
  side: 'friend' | 'enemy' | 'neutral';
}

/** Colour between a and b (capital.ts mixes the hull colour into the background). */
const mix = (a: number, b: number, t: number): number =>
  new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();

/** How the game draws each shape slot: faction colour and size (see fighters.ts, wingmen.ts, targets.ts, pods.ts, renderer.ts). */
const ENTITY: Record<ShapeKind, EntityInfo> = {
  player: { color: () => palette.friendly, radius: 60, side: 'friend' },
  wingman: { color: () => palette.wingman, radius: 24, side: 'friend' },
  wingmanB: { color: () => palette.wingman, radius: 24, side: 'friend' },
  wingmanC: { color: () => palette.wingman, radius: 24, side: 'friend' },
  fighter: { color: () => palette.fighter, radius: 28, side: 'enemy' },
  drone: { color: () => palette.enemy, radius: 26, side: 'enemy' },
  turret: { color: () => palette.turret, radius: 42, side: 'enemy' },
  static: { color: () => palette.enemyStatic, radius: 30, side: 'enemy' },
  pod: { color: () => palette.pod, radius: 22, side: 'neutral' },
  gunship: { color: () => palette.fighter, radius: 70, side: 'enemy' },
  lancer: { color: () => palette.fighter, radius: 28, side: 'enemy' },
  capital: { color: () => mix(palette.enemy, palette.background, 0.8), radius: 700, side: 'enemy' },
  capitalTurret: { color: () => palette.turret, radius: 60, side: 'enemy' },
  capitalEngine: { color: () => palette.fighter, radius: 90, side: 'enemy' },
  capitalArmour: { color: () => palette.enemyStatic, radius: 110, side: 'enemy' },
  capitalBridge: { color: () => palette.pod, radius: 80, side: 'enemy' },
  capitalCore: { color: () => palette.enemy, radius: 100, side: 'enemy' },
};

/** Screen the game is judged on: the 1280x800 reference of the camera tuning. */
const SCREEN = { width: 1280, height: 800 };
const NEAR = cameraParams.viewMin.default;
const FAR = cameraParams.viewMax.default;
/** Zoom levels of the audit: slowest flight, in between, top speed. */
const ZOOMS = [NEAR, (NEAR + FAR) / 2, FAR];
/** Where entities are placed in the audit, as fractions of half the screen. */
const SPOTS: readonly (readonly [number, number])[] = [
  [0, 0],
  [0.62, 0.35],
  [-0.62, -0.3],
  [0.55, -0.55],
  [-0.7, 0.5],
  [0.2, 0.6],
  [-0.25, -0.65],
  [0.75, 0],
  [-0.15, 0.2],
];

interface Placed {
  kind: ShapeKind;
  x: number;
  y: number;
  heading: number;
  scale: number;
  thrust?: number;
}

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene;
let camera: THREE.OrthographicCamera;
let background: Background;
let bullets: Record<Shot, BulletRenderer> | null = null;
const shipGroup = new THREE.Group();
const pools = new Map<ShapeKind, ShipArt[]>();
let size = { width: 0, height: 0 };

function init(width: number, height: number): void {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    document.getElementById('stage')!.appendChild(renderer.domElement);
    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
    background = createBackground();
    scene.add(background.object);
    scene.add(shipGroup);
  }
  if (size.width !== width || size.height !== height) {
    renderer.setSize(width, height);
    size = { width, height };
  }
}

function setStyle(id: string): void {
  if (!styleIds().includes(id)) throw new Error(`unknown style ${id}`);
  peekStyle(id === 'plain' ? null : id);
  scene.background = new THREE.Color(palette.background);
}

const art = (kind: ShapeKind, index: number): ShipArt => {
  let pool = pools.get(kind);
  if (!pool) pools.set(kind, (pool = []));
  while (pool.length <= index) {
    const a = createShipArt(kind, ENTITY[kind].color);
    shipGroup.add(a.object);
    pool.push(a);
  }
  return pool[index]!;
};

interface Shots {
  count: number;
  data: { x: Float32Array; y: Float32Array; vx: Float32Array; vy: Float32Array };
}
const shots = (pts: readonly (readonly [number, number])[], heading: number): Shots => ({
  count: pts.length,
  data: {
    x: Float32Array.from(pts.map((p) => p[0])),
    y: Float32Array.from(pts.map((p) => p[1])),
    vx: new Float32Array(pts.length).fill(Math.cos(heading)),
    vy: new Float32Array(pts.length).fill(Math.sin(heading)),
  },
});

type Shot = 'player' | 'enemy' | 'missile' | 'enemyMissile';
const SHOTS: readonly Shot[] = ['player', 'enemy', 'missile', 'enemyMissile'];

/** Draws the backdrop (always) and the given ships and shots; the camera sits at the origin. */
function draw(
  viewWidth: number,
  placed: readonly Placed[],
  shotSpots?: { kind: Shot; at: readonly (readonly [number, number])[] },
): void {
  const r = renderer!;
  const viewHeight = (viewWidth * size.height) / size.width;
  camera.left = -viewWidth / 2;
  camera.right = viewWidth / 2;
  camera.top = viewHeight / 2;
  camera.bottom = -viewHeight / 2;
  camera.updateProjectionMatrix();
  camera.position.set(0, 0, 0);
  scene.background = new THREE.Color(palette.background);
  background.update(0, 0, 0, 0, 0, { width: viewWidth, height: viewHeight });
  for (const pool of pools.values()) for (const a of pool) a.hide();
  const used = new Map<ShapeKind, number>();
  for (const p of placed) {
    const i = used.get(p.kind) ?? 0;
    used.set(p.kind, i + 1);
    art(p.kind, i).update({
      x: p.x,
      y: p.y,
      heading: p.heading,
      scale: p.scale,
      thrust: p.thrust ?? 1,
    });
  }
  if (!bullets) {
    const mk = (color: number, length: number, width: number): BulletRenderer =>
      createBulletRenderer(64, color, { length, width });
    bullets = {
      player: mk(1, 22, 5),
      enemy: mk(1, 14, 14),
      missile: mk(1, 26, 8),
      enemyMissile: mk(1, 34, 11), // renderer.ts: the enemy missiles, drawn in the enemy colour
    };
    for (const b of Object.values(bullets)) scene.add(b.object);
  }
  const colors: Record<Shot, number> = {
    player: palette.projectile,
    enemy: palette.enemyShot,
    missile: palette.missile,
    enemyMissile: palette.enemy,
  };
  for (const k of SHOTS) {
    (bullets[k].object.material as THREE.MeshBasicMaterial).color.setHex(colors[k]);
    bullets[k].update(shotSpots && shotSpots.kind === k ? shots(shotSpots.at, 0.3) : shots([], 0));
  }
  r.render(scene, camera);
}

/** Pixels of the last render, RGBA, top row first. */
function readPixels(): Uint8Array {
  const gl = renderer!.getContext();
  const { width, height } = size;
  const raw = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, raw);
  const out = new Uint8Array(raw.length);
  for (let y = 0; y < height; y++)
    out.set(raw.subarray((height - 1 - y) * width * 4, (height - y) * width * 4), y * width * 4);
  return out;
}

// Reference sheet -------------------------------------------------------------------------

interface SheetCell {
  kind: ShapeKind;
  /** Large drawing: pixels per radius unit. */
  px: number;
  /** Columns the cell spans. */
  span: number;
}

const SHEET_ORDER: readonly SheetCell[] = [
  { kind: 'player', px: 112, span: 1 },
  { kind: 'wingman', px: 112, span: 1 },
  { kind: 'wingmanB', px: 112, span: 1 },
  { kind: 'wingmanC', px: 112, span: 1 },
  { kind: 'fighter', px: 112, span: 1 },
  { kind: 'lancer', px: 112, span: 1 },
  { kind: 'drone', px: 112, span: 1 },
  { kind: 'gunship', px: 100, span: 1 },
  { kind: 'turret', px: 110, span: 1 },
  { kind: 'static', px: 110, span: 1 },
  { kind: 'pod', px: 112, span: 1 },
  { kind: 'capitalTurret', px: 112, span: 1 },
  { kind: 'capitalEngine', px: 100, span: 1 },
  { kind: 'capitalArmour', px: 100, span: 1 },
  { kind: 'capitalBridge', px: 100, span: 1 },
  { kind: 'capitalCore', px: 100, span: 1 },
  { kind: 'capital', px: 350, span: 4 },
];

const COLS = 4;

/** `zoom` scales the whole sheet (2 = twice as large, for close-ups); `only` limits it to some kinds. */
function sheet(
  styleId: string,
  only?: ShapeKind[],
  zoom = 1,
): { width: number; height: number; cells: number } {
  const CELL = 340 * zoom;
  init(Math.max(size.width, 16), Math.max(size.height, 16));
  setStyle(styleId); // before anything asks what the pack has
  const cells = SHEET_ORDER.filter((c) => (!only || only.includes(c.kind)) && has(c.kind));
  const rows: SheetCell[][] = [];
  let row: SheetCell[] = [];
  let used = 0;
  for (const c of cells) {
    if (used + c.span > COLS) {
      rows.push(row);
      row = [];
      used = 0;
    }
    row.push(c);
    used += c.span;
  }
  if (row.length) rows.push(row);
  const header = 54;
  const tall = 520 * zoom;
  const width = Math.max(...rows.map((r) => r.reduce((s, c) => s + c.span, 0)), 1) * CELL;
  const height = header + rows.reduce((s, r) => s + (r.some((c) => c.span > 1) ? tall : CELL), 0);
  init(width, height);
  setStyle(styleId);
  const stage = document.getElementById('stage')!;
  stage.querySelectorAll('.label').forEach((n) => n.remove());
  const placed: Placed[] = [];
  const labels: { x: number; y: number; html: string }[] = [
    {
      x: 14,
      y: 10,
      html: `<b>${styleId}</b>  ${activeStyle().manifest.name}: ${activeStyle().manifest.intent.slice(0, 150)}`,
    },
  ];
  let top = header;
  for (const r of rows) {
    const rowH = r.some((c) => c.span > 1) ? tall : CELL;
    let left = 0;
    for (const c of r) {
      const cx = left + (c.span * CELL) / 2;
      const cy = top + rowH / 2 - 8;
      // World y is up; the camera looks at the origin of a view as big as the canvas, so map pixels.
      const wx = cx - width / 2;
      const wy = height / 2 - cy;
      const info = ENTITY[c.kind];
      // The capital ship is wide: it lies across its full-width cell, the rest point up.
      const heading = c.span > 1 ? 0 : Math.PI / 2;
      placed.push({ kind: c.kind, x: wx, y: wy, heading, scale: c.px * zoom });
      // The same ship at its game size on the slowest zoom, beside it, for judging detail (not the huge ones).
      if (info.radius < 300) {
        const small = (info.radius * SCREEN.width) / NEAR;
        placed.push({
          kind: c.kind,
          x: wx + (c.span * CELL) / 2 - 38,
          y: wy - rowH / 2 + 46,
          heading: Math.PI / 2,
          scale: small,
        });
      }
      const def = activeStyle().ships[c.kind]!;
      labels.push({
        x: left + 12,
        y: top + 6,
        html: `<b>${c.kind}</b>\n${shapeTriangles(def)} tris, ${def.parts?.length ?? 0} parts`,
      });
      left += c.span * CELL;
    }
    top += rowH;
  }
  draw(width, placed);
  for (const l of labels) {
    const d = document.createElement('div');
    d.className = 'label';
    d.style.left = `${l.x}px`;
    d.style.top = `${l.y}px`;
    d.innerHTML = l.html;
    stage.appendChild(d);
  }
  return { width, height, cells: cells.length };
}

const has = (kind: ShapeKind): boolean => !!activeStyle().ships[kind];

// Contrast audit --------------------------------------------------------------------------

export interface AuditRow {
  style: string;
  entity: string;
  side: string;
  /** Visible width of the view in world units. */
  zoom: number;
  /** Worst spot of the five. */
  worst: EntityContrast;
  /** Mean ratio over the spots. */
  meanRatio: number;
  pass: boolean;
}

export interface TextRow {
  style: string;
  text: string;
  color: string;
  ratio: number;
  pass: boolean;
}

const hex = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;

/** Text colours the game puts straight over the scene: HUD canvas text (palette) and the DOM run HUD (fixed CSS). */
function textColours(): { text: string; color: number }[] {
  return [
    { text: 'HUD speed and evade bars, speed text (friendly)', color: palette.friendly },
    { text: 'HUD cues (enemyStatic)', color: palette.enemyStatic },
    { text: 'HUD squad order text (wingman)', color: palette.wingman },
    { text: 'HUD return-to-arena warning (enemy)', color: palette.enemy },
    { text: 'run HUD main text', color: 0xf2f6ff },
    { text: 'run HUD objective', color: 0xffd24a },
    { text: 'run HUD pips', color: 0x6cf0a0 },
    { text: 'run HUD pilot trait', color: 0xaab4c8 },
  ];
}

function audit(styleId: string): { rows: AuditRow[]; text: TextRow[]; markers: TextRow[] } {
  init(SCREEN.width, SCREEN.height);
  setStyle(styleId);
  const rows: AuditRow[] = [];
  const { width, height } = SCREEN;
  const backgroundLum: number[] = [];
  const entities: { name: string; kind?: ShapeKind; shot?: Shot }[] = [
    ...SHAPE_KINDS.filter(has).map((k) => ({ name: k, kind: k })),
    { name: 'shot: player bullet', shot: 'player' },
    { name: 'shot: enemy bullet', shot: 'enemy' },
    { name: 'shot: missile', shot: 'missile' },
    { name: 'shot: enemy missile', shot: 'enemyMissile' },
  ];
  let bgSample: Uint8Array | null = null;
  for (const zoom of ZOOMS) {
    const ppu = width / zoom;
    draw(zoom, []);
    const before = readPixels();
    if (!bgSample) bgSample = before;
    backgroundLum.push(luminancePercentile(before, 0.95));
    for (const e of entities) {
      const radius = e.kind ? ENTITY[e.kind].radius : 11;
      // Large hulls only make sense far out: at close zoom they fill the screen.
      if (e.kind && radius * ppu > 160) continue;
      const half = Math.ceil((e.kind ? 1.6 * radius : 20) * ppu) + 8;
      const spots = e.kind && radius * ppu > 60 ? SPOTS.slice(0, 2) : SPOTS;
      const at = spots.map(
        ([fx, fy]) => [(fx * zoom) / 2, (fy * zoom * height) / width / 2] as const,
      );
      if (e.kind) {
        draw(
          zoom,
          at.map(([x, y]) => ({
            kind: e.kind!,
            x,
            y,
            heading: 0.6,
            scale: radius,
            thrust: 1,
          })),
        );
      } else draw(zoom, [], { kind: e.shot!, at });
      const after = readPixels();
      const results = at.map(([x, y]) => {
        const px = Math.round(width / 2 + x * ppu);
        const py = Math.round(height / 2 - y * ppu);
        return measureEntity(before, after, width, {
          x0: Math.max(0, px - half),
          y0: Math.max(0, py - half),
          x1: Math.min(width, px + half),
          y1: Math.min(height, py + half),
        });
      });
      const seen = results.filter((r) => r.area > 0);
      const worst = (seen.length ? seen : results).reduce((a, b) => (b.ratio < a.ratio ? b : a));
      rows.push({
        style: styleId,
        entity: e.name,
        side: e.kind
          ? ENTITY[e.kind].side
          : e.shot === 'enemy' || e.shot === 'enemyMissile'
            ? 'enemy'
            : 'friend',
        zoom: Math.round(zoom),
        worst,
        meanRatio: results.reduce((s, r) => s + r.ratio, 0) / results.length,
        pass: seen.length > 0 && worst.ratio >= ENTITY_RATIO_TARGET,
      });
    }
  }
  const bgWorst = Math.max(...backgroundLum);
  const text = textColours().map((t) => {
    const ratio = contrastRatio(luminanceOfHex(t.color), bgWorst);
    return {
      style: styleId,
      text: t.text,
      color: hex(t.color),
      ratio,
      pass: ratio >= TEXT_RATIO_TARGET,
    };
  });
  const markerColours: [string, number][] = [
    ['lock ring', palette.lockRing],
    ['edge arrow: enemy fighter', palette.fighter],
    ['edge arrow: drone', palette.enemy],
    ['edge arrow: static', palette.enemyStatic],
    ['edge arrow: turret', palette.turret],
    ['edge arrow: wingman', palette.wingman],
    ['edge arrow: pod', palette.pod],
  ];
  const markers = markerColours.map(([name, c]) => {
    const ratio = contrastRatio(luminanceOfHex(c), bgWorst);
    return {
      style: styleId,
      text: name,
      color: hex(c),
      ratio,
      pass: ratio >= ENTITY_RATIO_TARGET,
    };
  });
  return { rows, text, markers };
}

// Frame time ------------------------------------------------------------------------------

function frameTime(styleId: string, shipsPerKind: number, frames: number) {
  init(SCREEN.width, SCREEN.height);
  setStyle(styleId);
  const kinds = SHAPE_KINDS.filter((k) => has(k) && !k.startsWith('capital'));
  const placed: Placed[] = [];
  let n = 0;
  for (const k of kinds)
    for (let i = 0; i < shipsPerKind; i++, n++) {
      const a = (n * 2.399) % (Math.PI * 2);
      const r = 150 + ((n * 97) % 800);
      placed.push({
        kind: k,
        x: Math.cos(a) * r,
        y: Math.sin(a) * r * 0.6,
        heading: a,
        scale: ENTITY[k].radius,
      });
    }
  const gl = renderer!.getContext();
  const px = new Uint8Array(4);
  const times: number[] = [];
  for (let f = 0; f < frames + 10; f++) {
    for (const p of placed) p.heading += 0.02;
    const t0 = performance.now();
    draw(NEAR, placed);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); // waits for the GPU
    const dt = performance.now() - t0;
    if (f >= 10) times.push(dt);
  }
  times.sort((a, b) => a - b);
  const info = renderer!.info.render;
  return {
    style: styleId,
    ships: placed.length,
    meanMs: times.reduce((s, t) => s + t, 0) / times.length,
    p95Ms: times[Math.floor(times.length * 0.95)]!,
    drawCalls: info.calls,
    triangles: info.triangles,
  };
}

declare global {
  interface Window {
    lab: {
      sheet: typeof sheet;
      audit: typeof audit;
      frameTime: typeof frameTime;
      styles: () => string[];
      kinds: () => ShapeKind[];
    };
  }
}

window.lab = {
  sheet,
  audit,
  frameTime,
  styles: styleIds,
  kinds: () => SHAPE_KINDS.slice(),
};
