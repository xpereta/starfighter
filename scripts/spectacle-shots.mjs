// Headless screenshots of the anime-spectacle presentation, saved to docs/reference/spectacle-ui/.
//   npm run dev -- --port 5191        (in another terminal)
//   node scripts/spectacle-shots.mjs http://localhost:5191 [only-this-shot]
// Uses the dev-only `window.__spectacle.inject(events)` to stage moments the sim would take a while to produce.
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://localhost:5173';
const only = process.argv[3] ?? null;
const out = new URL('../docs/reference/spectacle-ui/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));

const shot = async (name) => {
  if (only && only !== name) return;
  await page.screenshot({ path: `${out}${name}.png` });
  console.log('saved', name);
};
const wait = (ms) => page.waitForTimeout(ms);
const inject = (events) => page.evaluate((e) => window.__spectacle.inject(e), events);
const kill = (kind) => ({ type: 'Killed', entityId: -1, kind, x: 0, y: 0, radius: 20 });

await page.goto(`${base}/?style=anime-spectacle&dev`);
await page.waitForSelector('canvas');
await page.waitForSelector('#tuning-panel');
await wait(1200);
await page.keyboard.press('h'); // hide the tuning panel
await wait(800);
await shot('01-start');

// Start the run (Enter on START RUN) and fly.
await page.keyboard.press('Enter');
await wait(900);
await shot('02-battle-title-card');
await page.keyboard.down('w');
await page.keyboard.down('Space');
await wait(2600);
await shot('03-battle-hud');

await inject([{ type: 'PlayerDamaged', x: 0, y: 0, hull: 1 }]);
await wait(120);
await shot('04-hull-hit');

await inject([{ type: 'SalvoFired', count: 3 }, kill('fighter'), kill('drone'), kill('drone')]);
await wait(120);
await shot('05-kill-cam');
await wait(1500);
await page.keyboard.up('Space');
await page.keyboard.up('w');
await shot('06-after');

console.log(errors.length ? `console errors:\n${errors.join('\n')}` : 'no console errors');
await browser.close();
