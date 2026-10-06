import type { Point, ShapeDef } from '../../../src/render/style';
import {
  accent,
  bar,
  dark,
  flap,
  glass,
  greeble,
  hardpoint,
  light,
  line,
  lowerHalf,
  nacelle,
  ngon,
  outline,
  panel,
  rect,
  row,
  scar,
  shift,
  sym,
} from './shape-kit';

/** Rebel red-orange for markings on the friendly craft. */
const RED = 0xd9452a;
const SODIUM = 0xffb347;
/** Pale rim light along leading edges: the planet's hard light. */
const RIM = 0xeee9dc;

// Player: "Stingray" strike fighter ------------------------------------------------------------
// Long needle nose, S-foil wings spread in attack position with a cannon at each tip, four engine
// nacelles at the wing roots, an astromech socket behind the canopy. White, scuffed, red-orange
// markings; the starboard wing (y < 0) has taken fire.

const playerHalf: Point[] = [
  [1.18, 0],
  [0.96, 0.05],
  [0.7, 0.1],
  [0.46, 0.13],
  [0.24, 0.16],
  [0.12, 0.2],
  [-0.1, 0.52],
  [-0.28, 0.8],
  [0.34, 0.9],
  [-0.36, 0.94],
  [-0.64, 0.96],
  [-0.6, 0.5],
  [-0.74, 0.44],
  [-0.88, 0.4],
  [-0.9, 0.22],
  [-0.64, 0.14],
  [-0.72, 0],
];

const player: ShapeDef = {
  polygon: sym(playerHalf),
  shadow: lowerHalf(playerHalf),
  eye: [
    [0.5, 0.02],
    [0.42, 0.05],
    [0.34, 0.02],
    [0.42, -0.01],
  ],
  glow: [
    [-0.9, 0.31],
    [-0.9, -0.31],
  ],
  glowColor: 0xff8a3a,
  parts: [
    // Wing and fuselage plating.
    panel(
      [
        [0.1, 0.2],
        [-0.1, 0.52],
        [-0.27, 0.79],
        [-0.36, 0.93],
        [-0.63, 0.95],
        [-0.59, 0.5],
        [-0.4, 0.3],
        [-0.02, 0.2],
      ],
      { m: true },
    ),
    panel(
      [
        [0.8, 0],
        [0.46, 0.06],
        [0, 0.075],
        [-0.4, 0.075],
        [-0.62, 0],
      ],
      { m: true },
    ),
    // Wing flaps along the trailing edge and the red tip bands.
    flap(
      [
        [-0.5, 0.52],
        [-0.6, 0.52],
        [-0.63, 0.94],
        [-0.5, 0.92],
      ],
      { m: true, role: 'dark' },
    ),
    accent(
      [
        [-0.164, 0.62],
        [-0.203, 0.68],
        [-0.6, 0.68],
        [-0.6, 0.62],
      ],
      { m: true, c: RED },
    ),
    accent(
      [
        [-0.241, 0.74],
        [-0.265, 0.78],
        [-0.6, 0.79],
        [-0.6, 0.74],
      ],
      { m: true, c: RED },
    ),
    // Red nose cap and a stripe up the spine.
    accent(
      [
        [1.18, 0],
        [0.98, 0.047],
        [0.88, 0.054],
        [0.88, 0],
      ],
      { m: true, c: RED },
    ),
    accent(
      [
        [0.18, 0.012],
        [-0.38, 0.012],
        [-0.38, 0.04],
        [0.18, 0.04],
      ],
      { m: true, c: RED },
    ),
    // Engine nacelles: housing, intake, fins and the glowing exhaust.
    nacelle(
      [
        [-0.04, 0.25],
        [-0.08, 0.215],
        [-0.85, 0.215],
        [-0.9, 0.25],
        [-0.9, 0.37],
        [-0.86, 0.405],
        [-0.08, 0.405],
        [-0.04, 0.37],
      ],
      { m: true },
    ),
    greeble(
      [
        [-0.04, 0.27],
        [-0.08, 0.23],
        [-0.19, 0.23],
        [-0.19, 0.39],
        [-0.08, 0.39],
        [-0.04, 0.35],
      ],
      { m: true },
    ),
    line(
      [
        [-0.35, 0.22],
        [-0.35, 0.4],
      ],
      0.012,
      { m: true },
    ),
    line(
      [
        [-0.47, 0.22],
        [-0.47, 0.4],
      ],
      0.012,
      { m: true },
    ),
    line(
      [
        [-0.59, 0.22],
        [-0.59, 0.4],
      ],
      0.012,
      { m: true },
    ),
    light(
      [
        [-0.9, 0.265],
        [-0.9, 0.355],
        [-0.83, 0.355],
        [-0.83, 0.265],
      ],
      { m: true, c: 0xff7a2a },
    ),
    // Soot behind the port engines, worse on the left.
    scar([
      [-0.62, 0.215],
      [-0.9, 0.215],
      [-0.9, 0.3],
      [-0.7, 0.34],
      [-0.64, 0.3],
    ]),
    scar([
      [-0.68, -0.22],
      [-0.9, -0.22],
      [-0.9, -0.27],
      [-0.72, -0.27],
    ]),
    // Cockpit canopy and its reflection, astromech socket and blue lamp.
    glass(
      [
        [0.66, 0],
        [0.57, 0.065],
        [0.36, 0.078],
        [0.24, 0.045],
        [0.24, 0],
      ],
      { m: true },
    ),
    line(
      [
        [0.58, 0.04],
        [0.4, 0.052],
      ],
      0.012,
      { m: true, role: 'glass', c: 0x8fb8d4 },
    ),
    greeble(ngon(-0.2, 0, 0.08, 10)),
    light(ngon(-0.2, 0, 0.04, 8), { c: 0x66b2ff }),
    // Wingtip cannons.
    hardpoint(ngon(-0.31, 0.86, 0.05, 8), { m: true }),
    line(
      [
        [-0.32, 0.875],
        [0.3, 0.9],
      ],
      0.014,
      { m: true },
    ),
    // Panel lines across the fuselage and wings.
    line(
      [
        [0.52, 0.11],
        [0.52, -0.11],
      ],
      0.009,
    ),
    line(
      [
        [0.06, 0.16],
        [0.06, -0.16],
      ],
      0.009,
    ),
    line(
      [
        [0, 0.34],
        [-0.5, 0.4],
      ],
      0.008,
      { m: true },
    ),
    line(
      [
        [-0.2, 0.56],
        [-0.58, 0.6],
      ],
      0.008,
      { m: true },
    ),
    // Greebles, not quite symmetric: vents on the spine, a sensor stub, a repair patch.
    ...row(0.38, 0.02, 0.07, 0.07, 0.025, 3, (p) => greeble(p)),
    greeble(rect(0.12, -0.065, 0.13, 0.035)),
    greeble(rect(-0.4, -0.05, 0.1, 0.03)),
    panel(rect(-0.18, 0.48, 0.14, 0.08), { c: 0xb9b5a6 }),
    line(
      [
        [-0.25, 0.44],
        [-0.11, 0.44],
        [-0.11, 0.52],
        [-0.25, 0.52],
        [-0.25, 0.44],
      ],
      0.006,
    ),
    // Battle damage on the starboard wing: scorch, a breach and a streak back from it.
    scar([
      [-0.2, -0.6],
      [-0.34, -0.58],
      [-0.5, -0.7],
      [-0.4, -0.74],
      [-0.28, -0.68],
    ]),
    scar([
      [-0.32, -0.46],
      [-0.44, -0.47],
      [-0.6, -0.54],
      [-0.5, -0.56],
    ]),
    dark(ngon(-0.45, -0.7, 0.04, 6), { c: 0x050505 }),
    // Rim light along the leading edges.
    line(
      [
        [1.17, 0.005],
        [0.96, 0.05],
        [0.7, 0.1],
        [0.46, 0.13],
        [0.24, 0.16],
        [0.12, 0.2],
        [-0.1, 0.52],
        [-0.28, 0.8],
      ],
      0.014,
      { m: true, role: 'glow', c: RIM },
    ),
    // Running lights: amber on the port nacelle, green and red wing lights.
    light(rect(-0.5, 0.9, 0.05, 0.03), { c: 0xff3b30 }),
    light(rect(-0.5, -0.9, 0.05, 0.03), { c: 0x3bff6a }),
    light(ngon(0.05, 0.06, 0.02, 6), { c: SODIUM }),
  ],
};

// Wingman: "Dart" interceptor -------------------------------------------------------------------
// A thin dart fuselage between two long swept engine pods on short pylons (A-wing / Y-wing family),
// pale blue-grey. The silhouette is shared by three liveries so deaths cut the same outline.

const wingmanHalf: Point[] = [
  [1.22, 0],
  [0.9, 0.06],
  [0.55, 0.1],
  [0.2, 0.13],
  [0.1, 0.36],
  [0.4, 0.44],
  [0.56, 0.56],
  [0.34, 0.74],
  [-0.62, 0.74],
  [-0.94, 0.7],
  [-0.96, 0.46],
  [-0.7, 0.4],
  [-0.5, 0.2],
  [-0.64, 0.12],
  [-0.74, 0],
];

function wingmanWith(stripe: number, trim: number, extras: ShapeDef['parts'] = []): ShapeDef {
  return {
    polygon: sym(wingmanHalf),
    shadow: lowerHalf(wingmanHalf),
    eye: [
      [0.55, 0.02],
      [0.46, 0.05],
      [0.38, 0.02],
      [0.46, -0.01],
    ],
    glow: [
      [-0.94, 0.58],
      [-0.94, -0.58],
    ],
    glowColor: 0x66c6ff,
    parts: [
      // Pods and pylons.
      panel(
        [
          [0.34, 0.74],
          [0.56, 0.56],
          [0.4, 0.44],
          [0.1, 0.36],
          [0.0, 0.5],
          [-0.2, 0.46],
          [-0.2, 0.74],
        ],
        { m: true },
      ),
      nacelle(
        [
          [0.5, 0.58],
          [0.3, 0.72],
          [-0.9, 0.72],
          [-0.92, 0.48],
          [-0.55, 0.43],
          [0.4, 0.46],
        ],
        { m: true },
      ),
      greeble(
        [
          [0.5, 0.58],
          [0.46, 0.52],
          [0.4, 0.5],
          [0.34, 0.6],
          [0.38, 0.68],
          [0.44, 0.66],
        ],
        { m: true },
      ),
      // Livery stripes down each pod and across the nose.
      accent(
        [
          [0.22, 0.7],
          [0.2, 0.66],
          [-0.8, 0.66],
          [-0.85, 0.7],
        ],
        { m: true, c: stripe },
      ),
      accent(
        [
          [0.22, 0.52],
          [0.2, 0.48],
          [-0.7, 0.48],
          [-0.72, 0.52],
        ],
        { m: true, c: trim },
      ),
      accent(
        [
          [1.22, 0],
          [0.92, 0.056],
          [0.78, 0.065],
          [0.78, 0],
        ],
        { m: true, c: stripe },
      ),
      // Fuselage: canopy, spine and the tail fin.
      panel(
        [
          [0.9, 0],
          [0.55, 0.07],
          [0.2, 0.09],
          [-0.5, 0.1],
          [-0.7, 0],
        ],
        { m: true },
      ),
      glass(
        [
          [0.72, 0],
          [0.62, 0.05],
          [0.42, 0.065],
          [0.34, 0.03],
          [0.34, 0],
        ],
        { m: true },
      ),
      line(
        [
          [0.64, 0.032],
          [0.46, 0.044],
        ],
        0.01,
        { m: true, role: 'glass', c: 0x8fb8d4 },
      ),
      light(ngon(-0.3, 0, 0.035, 6), { c: 0x66b2ff }),
      // Exhausts, scorch and cooling vents on the pods.
      light(
        [
          [-0.96, 0.5],
          [-0.96, 0.68],
          [-0.88, 0.68],
          [-0.88, 0.5],
        ],
        { m: true, c: 0xff7a2a },
      ),
      scar(
        [
          [-0.7, 0.45],
          [-0.94, 0.47],
          [-0.94, 0.62],
          [-0.76, 0.58],
        ],
        { m: true },
      ),
      ...row(-0.1, 0.25, 0.6, 0.06, 0.1, 4, (p) => greeble(p)).map((g) => ({
        ...g,
        mirror: true,
      })),
      // Pylon struts and a laser hardpoint on each pod nose.
      line(
        [
          [0.16, 0.14],
          [0.12, 0.38],
        ],
        0.014,
        { m: true },
      ),
      hardpoint(bar(0.46, 0.54, 0.54, 0.56, 0.04), { m: true }),
      line(
        [
          [0.02, 0.12],
          [0.02, -0.12],
        ],
        0.008,
      ),
      line(
        [
          [-0.3, 0.1],
          [-0.3, -0.1],
        ],
        0.008,
      ),
      // Weathering: not symmetric.
      scar([
        [0.1, -0.5],
        [-0.1, -0.52],
        [-0.24, -0.62],
        [-0.06, -0.66],
      ]),
      panel(rect(0.2, -0.64, 0.2, 0.06), { c: 0x9aa8b4 }),
      greeble(rect(-0.4, 0.06, 0.12, 0.03)),
      ...(extras ?? []),
      // Rim light along the dart.
      line(
        [
          [1.21, 0.005],
          [0.9, 0.06],
          [0.55, 0.1],
          [0.2, 0.13],
          [0.1, 0.36],
          [0.4, 0.44],
          [0.56, 0.56],
          [0.34, 0.74],
        ],
        0.014,
        { m: true, role: 'glow', c: RIM },
      ),
    ],
  };
}

/** Wingmen: Red Squadron (red and white), Gold (yellow and blue) and Blue (blue and orange). */
const wingman = wingmanWith(RED, 0xf0ece0);
const wingmanB = wingmanWith(0xe6b422, 0x2f5fa8, [
  outline(shift(rect(0.02, 0, 0.16, 0.14), 0.0, 0), 0.008, { c: 0xe6b422 }),
]);
const wingmanC = wingmanWith(0x2f78c8, 0xe8832a);

export const friendlyShips = { player, wingman, wingmanB, wingmanC };
