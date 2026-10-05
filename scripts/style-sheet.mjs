// Reference sheet of a style pack: every ship slot drawn large on the pack's own backdrop, next to
// the same ship at its in-game size on the slowest zoom. Headless (software GL is fine).
//
//   node scripts/style-sheet.mjs <style> [--out=docs/reference/<style>] [--port=4231] [--each] [--only=player,fighter] [--zoom=2]
//
// Writes <out>/sheet.png; with --each also one close-up <out>/<kind>.png per ship slot.
import { mkdirSync } from 'node:fs';
import { flag, withLab } from './lib/lab-session.mjs';

const args = process.argv.slice(2);
const style = args.find((a) => !a.startsWith('--')) ?? 'plain';
const out = flag(args, 'out', `docs/reference/${style}`);
const port = Number(flag(args, 'port', '4231'));
const only = flag(args, 'only', '').split(',').filter(Boolean);
const zoom = Number(flag(args, 'zoom', '1'));
mkdirSync(out, { recursive: true });

await withLab(port, async (page) => {
  const shoot = async (kinds, file, z) => {
    const { width, height, cells } = await page.evaluate(
      ([s, k, zz]) => window.lab.sheet(s, k, zz),
      [style, kinds, z],
    );
    if (cells === 0) return;
    await page.setViewportSize({ width, height });
    await page.locator('#stage').screenshot({ path: file });
    console.log(`wrote ${file} (${width}x${height})`);
  };
  await shoot(only.length ? only : undefined, `${out}/sheet.png`, zoom);
  if (args.includes('--each')) {
    const kinds = await page.evaluate(() => window.lab.kinds());
    for (const kind of kinds) {
      await shoot([kind], `${out}/${kind}.png`, 2);
    }
  }
});
