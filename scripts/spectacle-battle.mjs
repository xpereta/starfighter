// Scripted battle in headless Chromium: `node scripts/spectacle-battle.mjs <port> <query> <seconds> [outPrefix]`.
// Flies a run's first battle (fire, sweep the nose, launch missiles, roll), records frame intervals and the
// time spent in the game's own frame callback, and takes screenshots at moments the effect pools are busy.
// Software GL (SwiftShader): intervals are far slower than on a real GPU, the callback time is the JS cost.
import { chromium } from '@playwright/test';

const [port = '4190', query = 'style=anime-spectacle', seconds = '30', prefix = ''] =
  process.argv.slice(2);
const browser = await chromium.launch({
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
  ],
});
const [vw, vh] = (process.env.VIEW ?? '1280x800').split('x').map(Number);
const page = await browser.newPage({ viewport: { width: vw, height: vh } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));

await page.addInitScript(() => {
  const raf = window.requestAnimationFrame.bind(window);
  const w = window;
  w.__frames = { stamps: [], cb: [] };
  window.requestAnimationFrame = (fn) =>
    raf((t) => {
      const t0 = performance.now();
      fn(t);
      w.__frames.cb.push(performance.now() - t0);
      w.__frames.stamps.push(t);
    });
});
await page.goto(`http://localhost:${port}/?${query}`);
await page.waitForSelector('canvas');
await page.keyboard.press('Enter'); // start battle 1
// OFF=post,backdrop,ships,combat,cards switches groups off (where the time goes).
for (const k of (process.env.OFF ?? '').split(',').filter(Boolean))
  await page.evaluate((key) => (globalThis.__spectacle.settings[key] = false), k);
await page.waitForTimeout(500);

const t0 = Date.now();
let shot = 0;
let lastE = 0;
let lastShift = 0;
let turn = 0;
await page.keyboard.down('KeyW');
await page.keyboard.down('Space');
const peaks = {};
while (Date.now() - t0 < Number(seconds) * 1000) {
  const now = Date.now() - t0;
  if (now - turn > 900) {
    turn = now;
    await page.keyboard.up('ArrowLeft');
    await page.keyboard.up('ArrowRight');
    await page.keyboard.down(Math.floor(now / 900) % 3 === 0 ? 'ArrowRight' : 'ArrowLeft');
  }
  if (now - lastE > 1800) {
    lastE = now;
    await page.keyboard.press('KeyE');
  }
  if (now - lastShift > 3500) {
    lastShift = now;
    await page.keyboard.press('ShiftLeft');
  }
  const stats = await page.evaluate(() => globalThis.__spectacle?.stats?.() ?? null);
  if (stats) {
    for (const [k, v] of Object.entries(stats))
      if (v)
        for (const [kk, vv] of Object.entries(v)) {
          const key = `${k}.${kk}`;
          if (typeof vv === 'number') peaks[key] = Math.max(peaks[key] ?? 0, vv);
        }
    const busy =
      (stats.combat?.explosions ?? 0) +
      (stats.combat?.sparks ?? 0) / 10 +
      (stats.ships?.brackets ?? 0) * 3 +
      (stats.ships?.launchFlashes ?? 0) * 3;
    if (prefix && busy > 8 && shot < 6 && now > 1500 + shot * 3000) {
      await page.screenshot({ path: `${prefix}-${shot++}.png` });
    }
  }
  await page.waitForTimeout(120);
}
const frames = await page.evaluate(() => {
  const f = window.__frames;
  const d = f.stamps.slice(1).map((t, i) => t - f.stamps[i]);
  return { d, cb: f.cb };
});
const q = (a, p) => [...a].sort((x, y) => x - y)[Math.floor((a.length - 1) * p)] ?? 0;
const avg = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
console.log(
  JSON.stringify(
    {
      query,
      frames: frames.d.length,
      intervalMs: {
        avg: +avg(frames.d).toFixed(1),
        p50: +q(frames.d, 0.5).toFixed(1),
        p95: +q(frames.d, 0.95).toFixed(1),
      },
      callbackMs: {
        avg: +avg(frames.cb).toFixed(2),
        p50: +q(frames.cb, 0.5).toFixed(2),
        p95: +q(frames.cb, 0.95).toFixed(2),
        max: +Math.max(...frames.cb).toFixed(1),
      },
      peaks,
      errors,
    },
    null,
    1,
  ),
);
await browser.close();
