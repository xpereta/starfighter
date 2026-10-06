// Headless screenshots of the combined anime-spectacle (visuals + presentation + audio), saved to
// docs/reference/spectacle-combined/.
//   npm run dev -- --port 5191        (in another terminal)
//   node scripts/spectacle-combined-shots.mjs http://localhost:5191
// Uses the dev-only `window.__presentation.inject(events)` to stage moments. Nothing is saved.
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://localhost:5173';
const out = new URL('../docs/reference/spectacle-combined/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));

const shot = async (name) => {
  await page.screenshot({ path: `${out}${name}.png` });
  console.log('saved', name);
};
const wait = (ms) => page.waitForTimeout(ms);
const inject = (events) => page.evaluate((e) => window.__presentation.inject(e), events);
const kill = (kind) => ({ type: 'Killed', entityId: -1, kind, x: 0, y: 0, radius: 20 });

await page.goto(`${base}/?style=anime-spectacle&dev`);
await page.waitForSelector('canvas');
await page.waitForSelector('#tuning-panel');
await wait(1500);
await page.keyboard.press('h'); // hide the tuning panel
await wait(800);
await shot('01-start');
await page.keyboard.press('Enter');
await wait(900);
await shot('02-battle-banner');
await page.keyboard.down('w');
await page.keyboard.down('Space');
await wait(3500);
await shot('03-battle');
await inject([{ type: 'SalvoFired', count: 3 }, kill('fighter'), kill('drone'), kill('drone')]);
await wait(150);
await shot('04-kill-cam');
await wait(1500);
await page.evaluate(() => globalThis.__sfDemo?.());
await wait(350);
await shot('05-blasts');
await page.keyboard.up('Space');
await page.keyboard.up('w');
await browser.close();
if (errors.length) {
  console.error('console errors:', errors);
  process.exitCode = 1;
}
