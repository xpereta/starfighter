import type { Point, ShapeDef, ShapePart } from '../../../src/render/style';
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
  nacelle,
  ngon,
  outline,
  panel,
  rect,
  row,
  scar,
  sym,
} from './shape-kit';

const RED = 0xc8321f;
const SODIUM = 0xffb347;
const RIM = 0xcfe0f0;
const AMBER = 0xe0a020;

// Gunship: "Hauler" -----------------------------------------------------------------------------
// A slab-sided dropship hull with two armoured sponsons, a gun turret on each, a chin cannon and a
// four-nozzle engine block. Squat, heavy, patched; hazard-striped, with Aliens-style sodium lamps.

const gunshipHalf: Point[] = [
  [1.32, 0],
  [1.24, 0.12],
  [0.98, 0.22],
  [0.7, 0.28],
  [0.62, 0.56],
  [0.4, 0.92],
  [0.1, 1.02],
  [-0.5, 0.98],
  [-0.64, 0.78],
  [-0.52, 0.58],
  [-0.78, 0.5],
  [-1.04, 0.46],
  [-1.1, 0.24],
  [-0.96, 0.14],
  [-1.04, 0],
];

const gunship: ShapeDef = {
  polygon: sym(gunshipHalf),
  shadow: lowerHalf(gunshipHalf),
  eye: [
    [1.0, 0.03],
    [0.86, 0.08],
    [0.76, 0.03],
    [0.86, -0.02],
  ],
  glow: [
    [-1.08, 0.34],
    [-1.08, 0.12],
    [-1.08, -0.12],
    [-1.08, -0.34],
  ],
  glowColor: 0xff8a3a,
  parts: [
    // Sponson plating and the main deck.
    panel(
      [
        [0.62, 0.56],
        [0.4, 0.92],
        [0.1, 1.02],
        [-0.5, 0.98],
        [-0.64, 0.78],
        [-0.52, 0.58],
        [0.3, 0.4],
      ],
      { m: true },
    ),
    panel(
      [
        [1.2, 0],
        [0.98, 0.18],
        [0.6, 0.24],
        [-0.5, 0.3],
        [-0.9, 0.2],
        [-0.96, 0],
      ],
      { m: true, c: undefined },
    ),
    // Cockpit windows, a row of them, and the bridge hump.
    glass(
      [
        [1.18, 0],
        [1.08, 0.09],
        [0.92, 0.1],
        [0.88, 0],
      ],
      { m: true },
    ),
    dark([
      [0.5, 0.2],
      [0.1, 0.24],
      [-0.3, 0.24],
      [-0.3, -0.24],
      [0.1, -0.24],
      [0.5, -0.2],
    ]),
    panel(rect(0.1, 0, 0.7, 0.34), { c: 0x8d9caa }),
    ...row(0.4, -0.2, 0, 0.07, 0.07, 6, (p) => light(p, { c: SODIUM })),
    // Sponson turrets with barrels.
    dark(ngon(0.18, 0.78, 0.26, 10), { m: true }),
    panel(ngon(0.18, 0.78, 0.2, 10), { m: true }),
    hardpoint(bar(0.2, 0.74, 0.44, 0.74, 0.07), { m: true }),
    hardpoint(bar(0.2, 0.86, 0.42, 0.86, 0.07), { m: true }),
    dark(rect(0.42, 0.8, 0.05, 0.14), { m: true }),
    // Hazard bands on the sponson rears and cargo ramp lines.
    ...hazardBands(
      [
        [-0.64, 0.78],
        [-0.5, 0.98],
        [-0.28, 0.96],
        [-0.28, 0.6],
        [-0.52, 0.58],
      ],
      5,
      0.06,
      0.06,
      0.9,
      [-0.45, 0.8],
    ).map((b) => accent(b, { m: true, c: AMBER })),
    line(
      [
        [-0.2, 0.3],
        [-0.2, -0.3],
      ],
      0.012,
    ),
    line(
      [
        [-0.55, 0.28],
        [-0.55, -0.28],
      ],
      0.012,
    ),
    // Engine block: four nozzles with housings.
    nacelle(
      [
        [-0.8, 0.46],
        [-1.04, 0.46],
        [-1.1, 0.24],
        [-0.96, 0.14],
        [-0.8, 0.14],
      ],
      { m: true, role: 'dark' },
    ),
    light(rect(-1.06, 0.34, 0.05, 0.14), { m: true, c: 0xff7a2a }),
    light(rect(-1.04, 0.12, 0.05, 0.14), { m: true, c: 0xff7a2a }),
    scar(
      [
        [-0.8, 0.46],
        [-1.1, 0.4],
        [-1.1, 0.24],
        [-0.8, 0.3],
      ],
      { m: true },
    ),
    // Panel lines, greebles, patches.
    line(
      [
        [0.9, 0.2],
        [0.9, -0.2],
      ],
      0.01,
    ),
    line(
      [
        [0.4, 0.3],
        [0.4, 0.6],
      ],
      0.01,
      { m: true },
    ),
    greeble(rect(0.55, 0.4, 0.22, 0.06)),
    greeble(rect(-0.1, -0.5, 0.3, 0.08)),
    greeble(rect(-0.3, 0.44, 0.2, 0.06)),
    panel(rect(0.35, -0.6, 0.26, 0.16), { c: 0xa5b2be }),
    outline(rect(0.35, -0.6, 0.26, 0.16), 0.008),
    accent(rect(1.0, 0.0, 0.1, 0.28), { c: RED }),
    scar([
      [0.2, -0.9],
      [0.0, -0.96],
      [-0.2, -0.86],
      [0.05, -0.8],
    ]),
    scar([
      [0.9, -0.2],
      [1.1, -0.14],
      [1.0, -0.06],
    ]),
    light(ngon(0.36, 0.96, 0.03, 6), { m: true, c: 0xff7a2a }),
    line(
      [
        [1.31, 0.005],
        [1.24, 0.12],
        [0.98, 0.22],
        [0.7, 0.28],
        [0.62, 0.56],
        [0.4, 0.92],
        [0.1, 1.02],
      ],
      0.016,
      { m: true, role: 'glow', c: RIM },
    ),
  ],
};

// Capital ship: "Bulwark" ----------------------------------------------------------------------
// A long armoured wedge. Armour plates cover the spine (and the core beneath), turret blisters line
// both flanks, a bridge tower and shield domes sit at the stern above a four-nozzle engine bank,
// the flank carries a lit hangar slot, window rows and hazard marks. Every plate has panel lines.

const capitalHalf: Point[] = [
  [1.52, 0],
  [1.2, 0.1],
  [0.8, 0.2],
  [0.5, 0.3],
  [0.45, 0.36],
  [0.2, 0.42],
  [0.15, 0.5],
  [-0.2, 0.58],
  [-0.3, 0.66],
  [-0.62, 0.7],
  [-0.9, 0.7],
  [-1.0, 0.6],
  [-1.3, 0.6],
  [-1.46, 0.5],
  [-1.5, 0.4],
];

/** Half width of the capital hull at x (the silhouette edge), to keep lines and fittings on the hull. */
function hw(x: number): number {
  for (let i = 0; i + 1 < capitalHalf.length; i++) {
    const [x1, y1] = capitalHalf[i]!;
    const [x2, y2] = capitalHalf[i + 1]!;
    if (x <= x1 && x >= x2) return y1 + ((y2 - y1) * (x1 - x)) / (x1 - x2 || 1);
  }
  return 0.4;
}

const capital: ShapeDef = {
  polygon: sym(capitalHalf),
  shadow: lowerHalf(capitalHalf),
  glow: [
    [-1.5, 0.28],
    [-1.5, 0.09],
    [-1.5, -0.09],
    [-1.5, -0.28],
  ],
  glowColor: 0x6fb4ff,
  parts: capitalParts(),
};

function capitalParts(): ShapePart[] {
  const parts: ShapePart[] = [];
  // Flank decking: lighter plating either side of the spine.
  parts.push(
    panel(
      [
        [1.2, 0.1],
        [0.5, 0.3],
        [0.15, 0.5],
        [-0.3, 0.66],
        [-0.62, 0.7],
        [-0.9, 0.7],
        [-1.0, 0.6],
        [-1.3, 0.6],
        [-1.44, 0.5],
        [-1.47, 0.4],
        [-0.6, 0.3],
        [0.5, 0.2],
      ],
      { m: true },
    ),
  );
  // Spine trench and the armour plates over it.
  parts.push(dark(rect(0.0, 0, 2.4, 0.18)));
  for (let i = 0; i < 6; i++) {
    const x = 1.15 - i * 0.4;
    parts.push(
      panel(
        [
          [x + 0.17, 0.0],
          [x + 0.17, 0.075],
          [x + 0.12, 0.09],
          [x - 0.12, 0.09],
          [x - 0.17, 0.075],
          [x - 0.17, 0.0],
        ],
        { m: true, c: i % 2 ? 0x8e9eae : 0x7f8fa0 },
      ),
    );
    parts.push(light(rect(x, 0.0, 0.05, 0.02), { c: SODIUM }));
  }
  // Panel grid on the flanks.
  for (let i = 0; i < 9; i++) {
    const x = 1.0 - i * 0.28;
    parts.push(
      line(
        [
          [x, 0.2],
          [x - 0.1, Math.max(0.21, Math.min(0.64, hw(x - 0.1) - 0.04))],
        ],
        0.008,
        { m: true },
      ),
    );
  }
  parts.push(
    line(
      [
        [1.1, 0.14],
        [-1.2, 0.3],
      ],
      0.01,
      { m: true },
    ),
    line(
      [
        [0.5, 0.3],
        [-0.9, 0.5],
      ],
      0.01,
      { m: true },
    ),
  );
  // Turret blisters along both flanks, with barrels.
  const blisters: Point[] = [0.7, 0.3, -0.1, -0.5].map((bx) => [bx, hw(bx) - 0.1] as Point);
  for (const [bx, by] of blisters) {
    parts.push(dark(ngon(bx, by, 0.075, 8), { m: true }));
    parts.push(panel(ngon(bx, by, 0.055, 8), { m: true }));
    parts.push(hardpoint(bar(bx, by, bx + 0.18, by + 0.02, 0.03), { m: true }));
  }
  // Hangar slot with lit interior (port only), window rows, hazard marks.
  parts.push(dark(rect(-0.3, 0.46, 0.4, 0.07)));
  parts.push(...row(-0.46, -0.14, 0.46, 0.04, 0.03, 4, (p) => light(p, { c: SODIUM })));
  parts.push(...row(0.2, -0.8, 0.3, 0.04, 0.02, 8, (p) => light(p, { m: true, c: 0xffd890 })));
  parts.push(
    ...hazardBands(
      [
        [-1.0, 0.6],
        [-1.3, 0.6],
        [-1.46, 0.5],
        [-1.0, 0.45],
      ],
      6,
      0.05,
      0.05,
      0.9,
      [-1.2, 0.54],
    ).map((b) => accent(b, { m: true, c: AMBER })),
  );
  parts.push(accent(rect(0.95, 0.0, 0.12, 0.05), { m: true, c: RED }));
  // Bridge tower with its windows and the shield domes either side.
  parts.push(
    panel(
      [
        [-0.78, 0.22],
        [-1.0, 0.22],
        [-1.0, -0.22],
        [-0.78, -0.22],
      ],
      { c: 0x93a3b3 },
    ),
    dark(rect(-0.9, 0, 0.1, 0.34)),
    glass([
      [-0.8, 0.16],
      [-0.84, 0.18],
      [-0.84, -0.18],
      [-0.8, -0.16],
    ]),
    ...row(-0.9, -0.9, 0, 0.03, 0.03, 1, (p) => light(p, { c: SODIUM })),
    dark(ngon(-0.9, 0.34, 0.11, 10), { m: true }),
    panel(ngon(-0.9, 0.34, 0.08, 10), { m: true, c: 0xaab8c6 }),
    light(ngon(-0.9, 0.34, 0.03, 6), { m: true, c: 0x66c6ff }),
  );
  // Engine bank: housing, four nozzles, scorch.
  parts.push(
    dark(rect(-1.4, 0, 0.14, 0.7)),
    ...[0.28, 0.09, -0.09, -0.28].map((y) => light(rect(-1.5, y, 0.07, 0.14), { c: 0x6fb4ff })),
    ...[0.28, 0.09, -0.09, -0.28].map((y) => nacelle(rect(-1.4, y, 0.2, 0.15), { role: 'dark' })),
    scar([
      [-1.2, 0.4],
      [-1.5, 0.42],
      [-1.5, 0.2],
      [-1.3, 0.22],
    ]),
    scar([
      [0.2, -0.5],
      [-0.1, -0.56],
      [-0.2, -0.46],
      [0.1, -0.4],
    ]),
    scar([
      [0.9, -0.2],
      [0.7, -0.26],
      [0.6, -0.2],
    ]),
  );
  parts.push(
    line(
      [
        [1.5, 0.01],
        [1.2, 0.1],
        [0.8, 0.2],
        [0.5, 0.3],
        [0.45, 0.36],
        [0.2, 0.42],
        [0.15, 0.5],
        [-0.2, 0.58],
        [-0.3, 0.66],
      ],
      0.016,
      { m: true, role: 'glow', c: RIM },
    ),
  );
  return parts;
}

// Capital ship parts ---------------------------------------------------------------------------

const turretHalf: Point[] = [
  [0.6, 0],
  [0.6, 0.08],
  [1.3, 0.08],
  [1.3, 0.28],
  [0.7, 0.28],
  [0.66, 0.5],
  [0.4, 0.86],
  [-0.2, 0.9],
  [-0.7, 0.7],
  [-0.9, 0.3],
  [-0.9, 0],
];
const capitalTurret: ShapeDef = {
  polygon: sym(turretHalf),
  shadow: lowerHalf(turretHalf),
  eye: ngon(-0.2, 0, 0.1, 6),
  parts: [
    dark(ngon(-0.1, 0, 0.7, 14)),
    panel(ngon(-0.1, 0, 0.6, 14)),
    line([...ngon(-0.1, 0, 0.45, 14), [0.35, 0]], 0.02),
    hardpoint(bar(0.5, 0.18, 1.28, 0.18, 0.18), { m: true }),
    dark(rect(1.22, 0.18, 0.12, 0.26), { m: true }),
    panel(rect(0.62, 0.18, 0.3, 0.3), { m: true }),
    greeble(rect(-0.6, 0.3, 0.3, 0.2)),
    scar([
      [0.6, 0.5],
      [0.66, 0.4],
      [0.5, 0.62],
    ]),
    line(
      [
        [0.4, 0.86],
        [-0.2, 0.9],
        [-0.7, 0.7],
      ],
      0.02,
      { m: true, role: 'glow', c: RIM },
    ),
  ],
};

const engineHalf: Point[] = [
  [0.9, 0],
  [0.9, 0.5],
  [0.3, 0.8],
  [-0.8, 0.8],
  [-1.0, 0.6],
  [-1.0, 0],
];
const capitalEngine: ShapeDef = {
  polygon: sym(engineHalf),
  shadow: lowerHalf(engineHalf),
  glow: [
    [-1.0, 0.36],
    [-1.0, -0.36],
  ],
  glowColor: 0x6fb4ff,
  parts: [
    panel(
      [
        [0.8, 0],
        [0.8, 0.46],
        [0.28, 0.72],
        [-0.76, 0.72],
        [-0.9, 0.56],
        [-0.9, 0],
      ],
      { m: true },
    ),
    dark(
      [
        [0.5, 0],
        [0.5, 0.4],
        [-0.5, 0.4],
        [-0.5, 0],
      ],
      { m: true },
    ),
    ...[0.2, -0.2, 0.6, -0.6].map((y) => nacelle(rect(-0.8, y, 0.3, 0.26), { role: 'dark' })),
    ...[0.36, -0.36].map((y) => light(rect(-1.0, y, 0.08, 0.3), { c: 0x6fb4ff })),
    line(
      [
        [0.2, 0.7],
        [0.2, -0.7],
      ],
      0.02,
    ),
    line(
      [
        [-0.3, 0.7],
        [-0.3, -0.7],
      ],
      0.02,
    ),
    scar([
      [-0.5, 0.7],
      [-0.9, 0.6],
      [-0.9, 0.3],
      [-0.6, 0.4],
    ]),
    ...row(0.55, 0.55, 0.45, 0.06, 0.06, 1, (p) => light(p, { m: true, c: SODIUM })),
  ],
};

const plateHalf: Point[] = [
  [1.0, 0],
  [1.0, 0.6],
  [0.8, 0.85],
  [-0.8, 0.85],
  [-1.0, 0.6],
  [-1.0, 0],
];
const capitalArmour: ShapeDef = {
  polygon: sym(plateHalf),
  shadow: lowerHalf(plateHalf),
  parts: [
    panel(
      [
        [0.9, 0],
        [0.9, 0.55],
        [0.74, 0.76],
        [-0.74, 0.76],
        [-0.9, 0.55],
        [-0.9, 0],
      ],
      { m: true },
    ),
    line(
      [
        [0.9, 0],
        [-0.9, 0],
      ],
      0.02,
    ),
    line(
      [
        [0.3, 0.76],
        [0.3, -0.76],
      ],
      0.016,
    ),
    line(
      [
        [-0.3, 0.76],
        [-0.3, -0.76],
      ],
      0.016,
    ),
    ...[0.8, 0.4, 0, -0.4, -0.8].flatMap((x) =>
      [0.62, -0.62].map((y) => dark(ngon(x, y, 0.045, 5))),
    ),
    ...hazardBands(
      [
        [0.9, 0.3],
        [0.9, 0.55],
        [0.74, 0.76],
        [0.4, 0.76],
        [0.4, 0.3],
      ],
      4,
      0.07,
      0.07,
      0.9,
      [0.65, 0.5],
    ).map((b) => accent(b, { m: true, c: AMBER })),
    scar([
      [-0.2, 0.3],
      [0.1, 0.4],
      [0.0, 0.55],
      [-0.3, 0.45],
    ]),
    scar([
      [0.4, -0.3],
      [0.7, -0.4],
      [0.6, -0.55],
    ]),
    line(
      [
        [1.0, 0.1],
        [1.0, 0.6],
        [0.8, 0.85],
        [-0.8, 0.85],
      ],
      0.02,
      { m: true, role: 'glow', c: RIM },
    ),
  ],
};

const bridgeHalf: Point[] = [
  [1.0, 0],
  [0.8, 0.4],
  [0.3, 0.6],
  [-0.4, 0.8],
  [-0.9, 0.6],
  [-1.0, 0],
];
const capitalBridge: ShapeDef = {
  polygon: sym(bridgeHalf),
  shadow: lowerHalf(bridgeHalf),
  eye: ngon(0.5, 0, 0.1, 6),
  parts: [
    panel(
      [
        [0.9, 0],
        [0.72, 0.36],
        [0.28, 0.54],
        [-0.38, 0.72],
        [-0.82, 0.54],
        [-0.9, 0],
      ],
      { m: true },
    ),
    dark(rect(0.1, 0, 0.9, 0.5)),
    glass([
      [0.5, 0.2],
      [0.4, 0.24],
      [-0.2, 0.24],
      [-0.3, 0.2],
      [-0.3, -0.2],
      [-0.2, -0.24],
      [0.4, -0.24],
      [0.5, -0.2],
    ]),
    ...row(0.35, -0.15, 0.0, 0.05, 0.28, 5, (p) => light(p, { c: SODIUM })),
    dark(ngon(-0.55, 0.4, 0.14, 8), { m: true }),
    light(ngon(-0.55, 0.4, 0.05, 6), { m: true, c: 0x66c6ff }),
    line(
      [
        [0.4, 0.56],
        [0.4, -0.56],
      ],
      0.016,
    ),
    greeble(rect(-0.1, 0.6, 0.3, 0.07), { m: true }),
    scar([
      [0.6, 0.3],
      [0.8, 0.2],
      [0.7, 0.4],
    ]),
    line(
      [
        [1.0, 0.02],
        [0.8, 0.4],
        [0.3, 0.6],
        [-0.4, 0.8],
      ],
      0.02,
      { m: true, role: 'glow', c: RIM },
    ),
  ],
};

const coreHalf: Point[] = [
  [1.0, 0],
  [0.86, 0.5],
  [0.5, 0.86],
  [0, 1.0],
  [-0.5, 0.86],
  [-0.86, 0.5],
  [-1.0, 0],
];
const capitalCore: ShapeDef = {
  polygon: sym(coreHalf),
  shadow: lowerHalf(coreHalf),
  eye: ngon(0, 0, 0.3, 8),
  glow: [[0, 0]],
  glowColor: 0xff7a2a,
  parts: [
    panel(ngon(0, 0, 0.9, 12), { c: 0x5f6c78 }),
    dark(ngon(0, 0, 0.7, 12)),
    ...[0, 1, 2, 3, 4, 5].map((i) => {
      const a = (i / 6) * Math.PI * 2;
      return light(
        bar(Math.cos(a) * 0.3, Math.sin(a) * 0.3, Math.cos(a) * 0.62, Math.sin(a) * 0.62, 0.1),
        {
          c: 0xff8a2a,
        },
      );
    }),
    light(ngon(0, 0, 0.22, 8), { c: 0xffd890 }),
    line([...ngon(0, 0, 0.8, 12), [0.8, 0]], 0.03),
    ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      return dark(ngon(Math.cos(a) * 0.9, Math.sin(a) * 0.9, 0.05, 5));
    }),
    scar([
      [0.5, 0.5],
      [0.8, 0.3],
      [0.7, 0.6],
    ]),
    line(
      [
        [1.0, 0.02],
        [0.86, 0.5],
        [0.5, 0.86],
        [0, 1.0],
      ],
      0.02,
      { m: true, role: 'glow', c: RIM },
    ),
  ],
};

export const bigShips = {
  gunship,
  capital,
  capitalTurret,
  capitalEngine,
  capitalArmour,
  capitalBridge,
  capitalCore,
};
