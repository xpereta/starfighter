// Headless screenshots of the spectacle style: `node scripts/spectacle-shots.mjs [port] [outDir]`.
// Needs a running preview of a build (`npm run build && npx vite preview --port 4190`).
// Software GL in headless Chromium: the picture is right, the frame rate is far below a real GPU.
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const port = process.argv[2] ?? '4190';
const out = process.argv[3] ?? 'docs/reference/spectacle';
mkdirSync(out, { recursive: true });
const base = `http://localhost:${port}`;

const browser = await chromium.launch({
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
  ],
});

async function open(query, viewport = { width: 1280, height: 800 }) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/?${query}`);
  await page.waitForSelector('canvas');
  return { page, errors };
}

const hold = async (page, keys, ms) => {
  for (const k of keys) await page.keyboard.down(k);
  await page.waitForTimeout(ms);
  for (const k of keys) await page.keyboard.up(k);
};

const shots = [];

// Compare: plain scene of the parent style and the spectacle pack at the same moment.
for (const style of ['anime-80s', 'anime-spectacle']) {
  const { page, errors } = await open(`style=${style}&practice&dev`);
  await page.keyboard.press('k'); // screenshot mode: no HUD, no panel
  await hold(page, ['KeyW', 'Space'], 2500);
  await page.screenshot({ path: `${out}/${style}-flight.png` });
  shots.push(`${style}-flight ${errors.length ? `ERRORS ${errors}` : 'ok'}`);
  await page.close();
}
// One shot per battle sky.
for (const sky of [1, 2, 3, 4]) {
  const { page, errors } = await open(`style=anime-spectacle&sky=${sky}&practice&dev`);
  await page.keyboard.press('k');
  await hold(page, ['KeyW'], 1500);
  await page.screenshot({ path: `${out}/sky-${sky}.png` });
  shots.push(`sky-${sky} ${errors.length ? `ERRORS ${errors}` : 'ok'}`);
  await page.close();
}
await browser.close();
console.log(shots.join('\n'));
