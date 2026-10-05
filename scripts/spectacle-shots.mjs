// Headless screenshots of the anime-spectacle presentation, saved to docs/reference/spectacle-ui/.
//   npm run dev -- --port 5191        (in another terminal)
//   node scripts/spectacle-shots.mjs http://localhost:5191 [only-this-shot]
// Uses the dev-only `window.__spectacle.inject(events)` and `window.__sf.world` (present with ?dev) to stage
// moments the simulation would take a while to produce. Only presentation state is staged; nothing is saved.
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
const poke = (fn, arg) =>
  page.evaluate(`(${fn.toString()})(window.__sf.world, ${JSON.stringify(arg ?? null)})`);

await page.goto(`${base}/?style=anime-spectacle&dev`);
await page.waitForSelector('canvas');
await page.waitForSelector('#tuning-panel');
await wait(1200);
await page.keyboard.press('h'); // hide the tuning panel
await poke((w) => {
  w.run.available = [
    { id: 1, name: 'Mara Vex', trait: 'sharpshooter', kills: 21 },
    { id: 2, name: 'Joss Hale', trait: 'guardian', kills: 8 },
  ];
  w.run.selectedVeterans = [1];
});
await wait(1200);
await shot('01-start');
await page.keyboard.press('s'); // move the cursor
await wait(500);
await shot('01b-start-cursor');
await page.keyboard.press('Space'); // tick the second veteran
await wait(250);
await page.keyboard.press('s'); // down to START RUN
await wait(250);
await page.keyboard.press('Enter');
await wait(1000);
await shot('02-battle-title-card');
await page.keyboard.down('w');
await page.keyboard.down('Space');
await wait(3200);
await shot('03-battle-hud');

await inject([{ type: 'PlayerDamaged', x: 0, y: 0, hull: 1 }]);
await wait(120);
await shot('04-hull-hit');

await inject([{ type: 'SalvoFired', count: 3 }, kill('fighter'), kill('drone'), kill('drone')]);
await wait(120);
await shot('05-kill-cam');
await wait(1200);
for (let i = 0; i < 6; i++) await inject([kill('drone')]);
await wait(300);
await shot('06-streak-and-feed');
await inject([{ type: 'PilotLost', pilotId: 1 }]);
await wait(1100);
await shot('07-pilot-lost');
await page.keyboard.up('Space');
await page.keyboard.up('w');

// Menus: stage the debrief, the victory and the defeat screens.
await poke((w) => {
  w.run.phase = 'debrief';
  w.run.battle = 2;
  w.run.battleKills = 14;
  w.run.battleLost = 1;
  w.run.cursor = 0;
  w.run.candidates = [
    { name: 'Nadia Quill', trait: 'hunter' },
    { name: 'Kenji Moth', trait: 'guardian' },
    { name: 'Rhea Drift', trait: 'bold' },
  ];
});
await wait(1400);
await shot('08-debrief');
await poke((w) => {
  w.run.phase = 'end';
  w.run.result = 'victory';
  w.run.battle = 4;
  w.run.cursor = 0;
});
await wait(1400);
await shot('09-victory');
await poke((w) => {
  w.run.phase = 'end';
  w.run.result = 'defeat';
  w.run.battle = 3;
});
await wait(200);
await page.evaluate(() => window.__sf.world.run.phase && 0);
await wait(1400);
await shot('10-defeat');

console.log(errors.length ? `console errors:\n${errors.join('\n')}` : 'no console errors');
await browser.close();
