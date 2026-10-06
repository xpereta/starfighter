// Frame cost of the style packs: draws a busy scene (every ship slot of the pack, N of each, all
// rotating, over the pack's backdrop) and times update + render + GPU wait per frame.
// Headless with software GL, so the numbers only compare packs with each other (never to a real GPU).
//
//   node scripts/frame-time.mjs [style ...] [--per-kind=8] [--frames=90] [--port=4251]
import { flag, withLab } from './lib/lab-session.mjs';

const args = process.argv.slice(2);
const port = Number(flag(args, 'port', '4251'));
const perKind = Number(flag(args, 'per-kind', '8'));
const frames = Number(flag(args, 'frames', '90'));
const asked = args.filter((a) => !a.startsWith('--'));
const pad = (s, n) => String(s).padEnd(n);

const rows = await withLab(port, async (page) => {
  const ids = asked.length ? asked : await page.evaluate(() => window.lab.styles());
  const out = [];
  for (const id of ids)
    out.push(
      await page.evaluate(([s, n, f]) => window.lab.frameTime(s, n, f), [id, perKind, frames]),
    );
  return out;
});

console.log(
  `${perKind} ships per slot, ${frames} frames, software GL (compare rows with each other only)`,
);
console.log(
  `${pad('style', 14)}${pad('ships', 7)}${pad('mean ms', 10)}${pad('p95 ms', 10)}${pad('draw calls', 12)}triangles`,
);
for (const r of rows)
  console.log(
    `${pad(r.style, 14)}${pad(r.ships, 7)}${pad(r.meanMs.toFixed(2), 10)}${pad(r.p95Ms.toFixed(2), 10)}${pad(r.drawCalls, 12)}${r.triangles}`,
  );
