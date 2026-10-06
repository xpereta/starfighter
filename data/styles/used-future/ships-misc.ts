import type { Point, ShapeDef } from '../../../src/render/style';
import {
  accent,
  bar,
  dark,
  glass,
  greeble,
  hardpoint,
  hazardBands,
  light,
  line,
  lowerHalf,
  ngon,
  outline,
  panel,
  rect,
  scar,
  sym,
} from './shape-kit';

const AMBER = 0xe0a020;
const SODIUM = 0xffb347;
const RIM = 0xdfe6d8;

// Turret: gun emplacement ----------------------------------------------------------------------
// A bolted octagonal base plate with hazard edging, a round armoured housing and twin barrels with
// muzzle brakes. Olive gunmetal, scorched around the barrels. Drawn with its muzzle pointing up.

const turretHalf: Point[] = [
  [0.74, 0],
  [0.74, 0.06],
  [1.3, 0.06],
  [1.3, 0.22],
  [0.88, 0.22],
  [0.84, 0.4],
  [0.66, 0.66],
  [0.34, 0.9],
  [-0.34, 0.9],
  [-0.7, 0.66],
  [-0.9, 0.3],
  [-0.9, 0],
];

const baseRing: Point[] = [
  [0.84, 0.3],
  [0.62, 0.6],
  [0.32, 0.84],
  [-0.32, 0.84],
  [-0.66, 0.62],
  [-0.84, 0.28],
  [-0.84, -0.28],
  [-0.66, -0.62],
  [-0.32, -0.84],
  [0.32, -0.84],
  [0.62, -0.6],
  [0.84, -0.3],
];

const turret: ShapeDef = {
  polygon: sym(turretHalf),
  shadow: lowerHalf(turretHalf),
  eye: ngon(-0.05, 0, 0.1, 6),
  parts: [
    panel(baseRing),
    // Hazard edging on the rear half of the base plate.
    ...hazardBands(
      [
        [-0.84, 0.28],
        [-0.66, 0.62],
        [-0.32, 0.84],
        [-0.32, 0.7],
        [-0.56, 0.56],
        [-0.7, 0.28],
      ],
      5,
      0.07,
      0.07,
      0.9,
      [-0.55, 0.55],
    ).map((b) => accent(b, { m: true, c: AMBER })),
    // Bolts around the plate.
    ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => {
      const a = (i / 12) * Math.PI * 2 + 0.26;
      return dark(ngon(Math.cos(a) * 0.74, Math.sin(a) * 0.74, 0.03, 5));
    }),
    // Housing: armoured drum, turntable ring, top hatch.
    dark(ngon(-0.05, 0, 0.58, 16)),
    panel(ngon(-0.05, 0, 0.52, 16), { c: 0x7d8c76 }),
    line([...ngon(-0.05, 0, 0.4, 14), [-0.05 + 0.4, 0]], 0.012),
    dark(ngon(-0.2, 0.05, 0.2, 8)),
    panel(ngon(-0.2, 0.05, 0.15, 8)),
    line(
      [
        [-0.2, -0.1],
        [-0.2, 0.2],
      ],
      0.008,
    ),
    // Barrels: recoil sleeves, bores and muzzle brakes.
    panel(
      [
        [0.4, 0.02],
        [0.74, 0.02],
        [0.74, 0.3],
        [0.4, 0.3],
      ],
      { m: true, c: 0x6e7d68 },
    ),
    hardpoint(bar(0.45, 0.14, 1.28, 0.14, 0.1), { m: true }),
    dark(
      [
        [1.18, 0.06],
        [1.3, 0.06],
        [1.3, 0.22],
        [1.18, 0.22],
      ],
      { m: true },
    ),
    line(
      [
        [1.0, 0.07],
        [1.0, 0.21],
      ],
      0.012,
      { m: true },
    ),
    // Ammunition box and feed, a sensor mast.
    greeble(rect(-0.62, 0.3, 0.3, 0.22)),
    line(
      [
        [-0.5, 0.3],
        [-0.3, 0.24],
        [0.2, 0.2],
        [0.5, 0.22],
      ],
      0.02,
    ),
    greeble(rect(-0.42, -0.38, 0.22, 0.12)),
    light(ngon(0.1, -0.45, 0.04, 6), { c: 0xff3b30 }),
    // Soot at the muzzles, a patched plate, rim light.
    scar([
      [0.8, 0.32],
      [0.9, 0.4],
      [0.8, 0.5],
      [0.72, 0.5],
    ]),
    scar([
      [0.7, -0.3],
      [0.84, -0.3],
      [0.8, -0.4],
    ]),
    panel(rect(0.3, -0.6, 0.3, 0.14), { c: 0x9fb09a }),
    outline(rect(0.3, -0.6, 0.3, 0.14), 0.007),
    line(
      [
        [0.34, 0.9],
        [-0.34, 0.9],
        [-0.7, 0.66],
      ],
      0.016,
      { m: true, role: 'glow', c: RIM },
    ),
  ],
};

// Static: hazard target hulk -------------------------------------------------------------------
// A dented hexagonal drum with diagonal amber and black hazard bands, a strobe on top and
// a bracket frame. Scrap that has been shot at for years.

const staticHex: Point[] = [
  [0.96, 0],
  [0.5, 0.86],
  [-0.5, 0.86],
  [-0.96, 0],
  [-0.5, -0.86],
  [0.5, -0.86],
];

const staticShape: ShapeDef = {
  polygon: staticHex,
  shadow: [
    [0.96, 0],
    [0.5, -0.86],
    [-0.5, -0.86],
    [-0.96, 0],
  ],
  eye: ngon(0, 0, 0.12, 6),
  parts: [
    panel(
      [
        [0.84, 0],
        [0.44, 0.74],
        [-0.44, 0.74],
        [-0.84, 0],
        [-0.44, -0.74],
        [0.44, -0.74],
      ],
      { c: 0xc89a30 },
    ),
    ...hazardBands(
      [
        [0.84, 0],
        [0.44, 0.74],
        [-0.44, 0.74],
        [-0.84, 0],
        [-0.44, -0.74],
        [0.44, -0.74],
      ],
      7,
      0.16,
      0.16,
      0.9,
    ).map((b) => dark(b)),
    // Central hub with its strobe.
    dark(ngon(0, 0, 0.3, 6)),
    panel(ngon(0, 0, 0.24, 6), { c: 0xe4b44a }),
    // Frame bolts and brackets.
    ...staticHex.map(([x, y]) => dark(ngon(x * 0.82, y * 0.82, 0.05, 5))),
    greeble(rect(0.62, 0, 0.12, 0.3)),
    greeble(rect(-0.62, 0.1, 0.12, 0.26)),
    // Dents and bullet scars.
    scar([
      [0.2, 0.5],
      [0.45, 0.58],
      [0.35, 0.7],
      [0.12, 0.62],
    ]),
    scar([
      [-0.5, -0.3],
      [-0.3, -0.45],
      [-0.2, -0.3],
    ]),
    dark(ngon(-0.3, 0.35, 0.05, 6), { c: 0x050505 }),
    dark(ngon(0.4, -0.2, 0.04, 6), { c: 0x050505 }),
    line(
      [
        [0.96, 0],
        [0.5, 0.86],
        [-0.5, 0.86],
      ],
      0.02,
      { role: 'glow', c: 0xfff0c0 },
    ),
    light(ngon(0.5, 0.5, 0.03, 6), { c: 0xff3b30 }),
  ],
};

// Pod: rescue capsule ---------------------------------------------------------------------------
// A rounded life pod: porthole with a glowing occupant, four stub thrusters, a hatch, stencils and
// a sodium recovery strobe. Pale, scuffed, unmistakably something to protect.

const podShape: ShapeDef = {
  polygon: ngon(0, 0, 1, 16),
  shadow: [
    [1, 0],
    ...ngon(0, 0, 1, 16)
      .filter((p) => p[1] < 0)
      .reverse(),
    [-1, 0],
  ] as Point[],
  eye: ngon(0, 0, 0.17, 8),
  parts: [
    panel(ngon(0, 0, 0.9, 16)),
    dark(ngon(0, 0, 0.5, 14)),
    glass(ngon(0, 0, 0.43, 14)),
    line([...ngon(0, 0, 0.62, 14), [0.62, 0]], 0.02),
    // Thrusters at the quarters.
    ...[0.785, 2.356, 3.927, 5.498].map((a) =>
      dark(ngon(Math.cos(a) * 0.82, Math.sin(a) * 0.82, 0.13, 6)),
    ),
    ...[0.785, 2.356, 3.927, 5.498].map((a) =>
      light(ngon(Math.cos(a) * 0.82, Math.sin(a) * 0.82, 0.05, 5), { c: 0x66c6ff }),
    ),
    // Hatch, stencils and clamps.
    outline(rect(0, -0.72, 0.36, 0.16), 0.01),
    accent(rect(0.0, 0.74, 0.3, 0.07), { c: 0xe0661e }),
    accent(rect(-0.74, 0.0, 0.07, 0.3), { c: 0xe0661e }),
    greeble(rect(0.72, 0, 0.1, 0.2)),
    scar([
      [0.5, 0.4],
      [0.7, 0.3],
      [0.62, 0.55],
    ]),
    light(ngon(0.6, -0.5, 0.05, 6), { c: SODIUM }),
    line(
      [
        [1, 0],
        [0.92, 0.38],
        [0.7, 0.7],
        [0.38, 0.92],
        [0, 1],
      ],
      0.02,
      { role: 'glow', c: 0xffffff },
    ),
  ],
};

export const miscShips = { turret, static: staticShape, pod: podShape };
