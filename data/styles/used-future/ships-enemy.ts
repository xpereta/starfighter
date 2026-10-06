import type { Point, ShapeDef } from '../../../src/render/style';
import {
  accent,
  bar,
  dark,
  glass,
  greeble,
  hardpoint,
  light,
  line,
  lowerHalf,
  nacelle,
  ngon,
  panel,
  rect,
  row,
  scar,
  sym,
} from './shape-kit';

const RED = 0xc8321f;
const SODIUM = 0xffb347;
const RIM = 0xcfe0f0;

// Fighter: "Raider" -----------------------------------------------------------------------------
// A cold steel pod slung between two long hexagonal solar-blade wings on thick struts (the
// TIE family, seen from above): a sensor eye, chin cannons, spoked panels, an orange running lamp
// at each blade tip. Wear is uneven: one blade has been replaced with a lighter spare, one is scorched.

const fighterHalf: Point[] = [
  [0.7, 0],
  [0.66, 0.1],
  [0.52, 0.2],
  [0.32, 0.29],
  [0.14, 0.32],
  [0.14, 0.52],
  [0.6, 0.52],
  [0.92, 0.8],
  [0.6, 1.08],
  [-0.6, 1.08],
  [-0.92, 0.8],
  [-0.6, 0.52],
  [-0.14, 0.52],
  [-0.14, 0.32],
  [-0.36, 0.28],
  [-0.56, 0.16],
  [-0.64, 0],
];

/** One hexagonal blade, upper side: frame, spoked panel face, hub. */
const hexBlade: Point[] = [
  [0.92, 0.8],
  [0.6, 0.52],
  [-0.6, 0.52],
  [-0.92, 0.8],
  [-0.6, 1.08],
  [0.6, 1.08],
];
const hexFace: Point[] = [
  [0.78, 0.8],
  [0.55, 0.59],
  [-0.55, 0.59],
  [-0.78, 0.8],
  [-0.55, 1.01],
  [0.55, 1.01],
];

const fighter: ShapeDef = {
  polygon: sym(fighterHalf),
  shadow: lowerHalf(fighterHalf),
  eye: ngon(0.3, 0, 0.1, 6),
  glow: [
    [-0.62, 0.07],
    [-0.62, -0.07],
  ],
  glowColor: 0x6fb4ff,
  parts: [
    // Blades: dark frame, lighter face, spokes and hub.
    dark(hexBlade, { m: true }),
    panel(hexFace, { m: true }),
    ...[0, 1, 2, 3, 4, 5].map((i) => {
      const v = hexFace[i]!;
      return line(
        [
          [0, 0.8],
          [v[0] * 0.95, 0.8 + (v[1] - 0.8) * 0.95],
        ],
        0.016,
        { m: true },
      );
    }),
    dark(ngon(0, 0.8, 0.13, 6), { m: true }),
    light(ngon(0, 0.8, 0.05, 6), { m: true, c: SODIUM }),
    // Struts, with an access hatch.
    dark(bar(0, 0.3, 0, 0.54, 0.26), { m: true }),
    line(
      [
        [0.12, 0.34],
        [0.12, 0.5],
      ],
      0.01,
      { m: true, role: 'glow', c: RIM },
    ),
    // The pod: shell, equator seam, front window ring and the red sensor eye housing.
    panel(ngon(0, 0, 0.34, 12), { c: 0x6c7f94 }),
    dark(ngon(0.2, 0, 0.2, 10)),
    glass(ngon(0.2, 0, 0.14, 10)),
    line(
      [
        [-0.34, 0],
        [-0.05, 0],
      ],
      0.012,
    ),
    line(
      [
        [0.08, 0.31],
        [0.08, -0.31],
      ],
      0.012,
    ),
    // Chin cannons and a sensor stub.
    hardpoint(bar(0.46, 0.09, 0.69, 0.07, 0.05)),
    hardpoint(bar(0.46, -0.09, 0.69, -0.07, 0.05)),
    greeble(rect(-0.28, 0.1, 0.12, 0.05)),
    // Tip lamps and rank stripes, not the same on both blades.
    light(ngon(0.9, 0.8, 0.035, 6), { m: true, c: 0xff7a2a }),
    accent(rect(-0.2, 0.9, 0.5, 0.045), { c: RED }),
    accent(rect(0.35, -0.9, 0.3, 0.045), { c: RED }),
    // The spare blade (port) is lighter; the starboard one is scorched.
    panel(
      [
        [0.55, 0.59],
        [-0.55, 0.59],
        [-0.78, 0.8],
        [0.78, 0.8],
      ],
      { c: 0x93a5b8 },
    ),
    scar([
      [0.3, -0.62],
      [0.7, -0.78],
      [0.5, -0.9],
      [0.1, -0.8],
    ]),
    scar([
      [-0.4, -0.95],
      [-0.2, -0.99],
      [-0.1, -0.88],
    ]),
    // Rim light along the leading edges of the blades and pod.
    line(
      [
        [0.66, 0.1],
        [0.52, 0.2],
        [0.32, 0.29],
        [0.14, 0.32],
      ],
      0.016,
      { m: true, role: 'glow', c: RIM },
    ),
    line(
      [
        [0.6, 1.08],
        [0.92, 0.8],
        [0.6, 0.52],
      ],
      0.018,
      { m: true, role: 'glow', c: RIM },
    ),
  ],
};

// Lancer: missile fighter -----------------------------------------------------------------------
// A long spear nose, forward-swept stub wings and a rack of two missiles on each tip, red noses.

const lancerHalf: Point[] = [
  [1.32, 0],
  [0.9, 0.07],
  [0.55, 0.13],
  [0.3, 0.18],
  [0.05, 0.2],
  [0.4, 0.7],
  [0.64, 0.88],
  [0.62, 1.0],
  [0.12, 1.0],
  [0.02, 0.92],
  [-0.62, 0.34],
  [-0.9, 0.24],
  [-0.8, 0.12],
  [-0.9, 0],
];

const lancer: ShapeDef = {
  polygon: sym(lancerHalf),
  shadow: lowerHalf(lancerHalf),
  eye: [
    [0.62, 0.02],
    [0.5, 0.06],
    [0.4, 0.02],
    [0.5, -0.02],
  ],
  glow: [
    [-0.9, 0.12],
    [-0.9, -0.12],
  ],
  glowColor: 0xff6a3a,
  parts: [
    panel(
      [
        [0.05, 0.2],
        [0.4, 0.7],
        [0.64, 0.88],
        [0.6, 0.98],
        [0.14, 0.98],
        [0.04, 0.9],
        [-0.6, 0.34],
        [-0.3, 0.22],
      ],
      { m: true },
    ),
    // Missile racks on the tips: two missiles each, red warheads.
    dark(bar(0.6, 0.84, 0.1, 0.84, 0.1), { m: true }),
    dark(bar(0.6, 0.94, 0.1, 0.94, 0.1), { m: true }),
    accent(
      [
        [0.64, 0.8],
        [0.7, 0.84],
        [0.64, 0.88],
      ],
      { m: true, c: 0xff5030 },
    ),
    accent(
      [
        [0.62, 0.9],
        [0.68, 0.94],
        [0.62, 0.98],
      ],
      { m: true, c: 0xff5030 },
    ),
    line(
      [
        [0.5, 0.79],
        [0.5, 0.99],
      ],
      0.01,
      { m: true },
    ),
    line(
      [
        [0.3, 0.79],
        [0.3, 0.99],
      ],
      0.01,
      { m: true },
    ),
    // Fuselage: dorsal plating, canopy slit, spear nose in red-orange.
    panel(
      [
        [1.0, 0],
        [0.55, 0.09],
        [0.1, 0.12],
        [-0.5, 0.14],
        [-0.8, 0],
      ],
      { m: true },
    ),
    accent(
      [
        [1.32, 0],
        [0.98, 0.058],
        [0.86, 0.07],
        [0.86, 0],
      ],
      { m: true, c: RED },
    ),
    glass(
      [
        [0.5, 0],
        [0.4, 0.045],
        [0.2, 0.06],
        [0.14, 0.03],
        [0.14, 0],
      ],
      { m: true },
    ),
    // Engine block: twin nozzles.
    nacelle(
      [
        [-0.5, 0.2],
        [-0.9, 0.22],
        [-0.9, 0.04],
        [-0.5, 0.04],
      ],
      { m: true, role: 'dark' },
    ),
    light(rect(-0.9, 0.13, 0.05, 0.12), { m: true, c: 0xff7a2a }),
    scar([
      [-0.6, 0.2],
      [-0.9, 0.24],
      [-0.9, 0.12],
      [-0.7, 0.1],
    ]),
    // Panel lines and greebles.
    line(
      [
        [0.35, 0.16],
        [0.35, -0.16],
      ],
      0.009,
    ),
    line(
      [
        [0.0, 0.6],
        [-0.3, 0.44],
      ],
      0.009,
      { m: true },
    ),
    line(
      [
        [0.22, 0.5],
        [-0.1, 0.32],
      ],
      0.009,
      { m: true },
    ),
    ...row(-0.35, 0.15, 0.1, 0.06, 0.025, 3, (p) => greeble(p)),
    greeble(rect(0.5, -0.06, 0.1, 0.025)),
    scar([
      [0.3, -0.62],
      [0.2, -0.78],
      [0.0, -0.7],
      [0.12, -0.56],
    ]),
    light(ngon(0.62, 0.99, 0.03, 6), { m: true, c: 0xff7a2a }),
    line(
      [
        [1.31, 0.005],
        [0.9, 0.07],
        [0.55, 0.13],
        [0.3, 0.18],
        [0.05, 0.2],
        [0.4, 0.7],
        [0.64, 0.88],
      ],
      0.014,
      { m: true, role: 'glow', c: RIM },
    ),
  ],
};

// Drone: probe droid ----------------------------------------------------------------------------
// A rust and brass sensor probe: domed body, four leg-spikes, one long antenna forward, a big
// photoreceptor eye. Light, jittery and cheap-looking.

const droneHalf: Point[] = [
  [1.2, 0],
  [0.58, 0.07],
  [0.46, 0.2],
  [0.56, 0.58],
  [0.76, 0.8],
  [0.46, 0.7],
  [0.24, 0.5],
  [0.0, 0.54],
  [-0.2, 0.9],
  [-0.28, 0.5],
  [-0.46, 0.42],
  [-0.88, 0.3],
  [-0.9, 0.12],
  [-0.62, 0.1],
  [-0.7, 0],
];

const drone: ShapeDef = {
  polygon: sym(droneHalf),
  shadow: lowerHalf(droneHalf),
  eye: ngon(0.28, 0, 0.12, 8),
  glow: [
    [-0.78, 0.2],
    [-0.78, -0.2],
  ],
  glowColor: 0xff7a3a,
  parts: [
    // Body dome: ring, segments, plating.
    panel(ngon(0, 0, 0.5, 14), { c: 0x9a7448 }),
    dark(ngon(0, 0, 0.36, 14)),
    panel(ngon(0, 0, 0.3, 12), { c: 0xb98a5a }),
    ...[0, 1, 2, 3, 4, 5].map((i) => {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      return line(
        [
          [Math.cos(a) * 0.1, Math.sin(a) * 0.1],
          [Math.cos(a) * 0.36, Math.sin(a) * 0.36],
        ],
        0.014,
      );
    }),
    // Eye: housing and lens.
    dark(ngon(0.28, 0, 0.17, 8)),
    // Leg spikes, antenna: joints and feet.
    line(
      [
        [0.5, 0.2],
        [0.56, 0.56],
        [0.74, 0.78],
      ],
      0.03,
      { m: true },
    ),
    line(
      [
        [0.16, 0.34],
        [0.0, 0.52],
        [-0.18, 0.88],
      ],
      0.03,
      { m: true },
    ),
    dark(ngon(0.56, 0.56, 0.05, 6), { m: true }),
    dark(ngon(0.0, 0.52, 0.05, 6), { m: true }),
    light(ngon(0.76, 0.8, 0.03, 6), { m: true, c: 0xff4a2a }),
    light(ngon(-0.2, 0.9, 0.03, 6), { m: true, c: 0xff4a2a }),
    line(
      [
        [0.58, 0.0],
        [1.18, 0.0],
      ],
      0.035,
    ),
    light(ngon(1.18, 0, 0.03, 6), { c: 0xff4a2a }),
    // Thruster pods at the back.
    nacelle(
      [
        [-0.46, 0.34],
        [-0.88, 0.3],
        [-0.9, 0.12],
        [-0.5, 0.14],
      ],
      { m: true, role: 'panel' },
    ),
    light(rect(-0.9, 0.2, 0.04, 0.1), { m: true, c: 0xff7a2a }),
    // Dents, patch plates and soot (not symmetric).
    scar([
      [-0.3, -0.3],
      [-0.1, -0.4],
      [0.1, -0.3],
      [-0.1, -0.22],
    ]),
    panel(rect(0.0, 0.3, 0.2, 0.1), { c: 0x7b7f86 }),
    greeble(rect(-0.2, -0.1, 0.1, 0.04)),
    greeble(rect(-0.22, 0.12, 0.08, 0.03)),
    line(
      [
        [0.48, 0.18],
        [0.32, 0.4],
        [0.2, 0.46],
      ],
      0.008,
      { role: 'dark' },
    ),
    line(
      [
        [1.19, 0.004],
        [0.6, 0.075],
        [0.48, 0.2],
      ],
      0.014,
      { m: true, role: 'glow', c: 0xe8d8b8 },
    ),
  ],
};

export const enemyShips = { fighter, lancer, drone };
