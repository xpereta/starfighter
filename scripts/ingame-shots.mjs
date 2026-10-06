// Headless in-game screenshots of the enemies Prototype 5 added, drawn by a style pack:
//   node scripts/ingame-shots.mjs [style=used-future] [--port=4251] [--out=docs/reference/<style>]
// Starts a Vite dev server, opens `/?style=<id>&dev&practice`, spawns each enemy through the dev
// panel (Spawn section) and saves ingame-<name>.png with the panel hidden (software GL, so slow).
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { flag } from './lib/lab-session.mjs';

const args = process.argv.slice(2);
const style = args.find((a) => !a.startsWith('--')) ?? 'used-future';
const port = Number(flag(args, 'port', '4251'));
const out = flag(args, 'out', `docs/reference/${style}`);
mkdirSync(out, { recursive: true });

const server = await createServer({
  configFile: false,
  root: process.cwd(),
  logLevel: 'error',
  server: { port, strictPort: true, host: '127.0.0.1' },
});
await server.listen();
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const panel = page.locator('#tuning-panel');
  const button = (name) => panel.getByRole('button', { name, exact: true });
  const shot = async (name, delay = 300) => {
    await page.keyboard.press('h'); // hide the panel
    await page.waitForTimeout(delay);
    await page.screenshot({ path: `${out}/ingame-${name}.png` });
    await page.keyboard.press('h');
    console.log('saved', name);
  };
  await page.goto(`http://127.0.0.1:${port}/?style=${style}&dev&practice`);
  await panel.waitFor();
  await panel.getByRole('button', { name: /^. Spawn$/ }).click();
  const fresh = async () => {
    await button('Clear all enemies (X)').click();
    await page.waitForTimeout(200);
  };
  const waitStatus = (re, timeout = 60_000) =>
    panel.locator('[role=status]').filter({ hasText: re }).waitFor({ timeout });

  await fresh();
  await button('Spawn Gunship').click();
  await page.waitForTimeout(2500);
  await shot('gunship');

  await fresh();
  await button('Spawn Formation wing').click();
  await page.waitForTimeout(1000);
  await shot('wing');

  await fresh();
  // The wingmen shoot lancers down fast: spawn them again until a missile is in the air.
  for (let tries = 0; tries < 12; tries++) {
    await button('Spawn Missile fighter').click();
    const seen = await waitStatus(/[1-9]\d* enemy missiles/, 8000).then(
      () => true,
      () => false,
    );
    if (seen) break;
  }
  await shot('lancer-missile', 0);

  await fresh();
  await button('Spawn Capital ship').click();
  await waitStatus(/capital: 17\/17 parts/);
  for (let i = 0; i < 4; i++) {
    await page.keyboard.down('w');
    await page.waitForTimeout(4000);
    await page.keyboard.up('w');
    await shot(`capital-${i}`);
  }
  if (errors.length) console.warn('page errors:\n' + errors.join('\n'));
} finally {
  await browser.close();
  await server.close();
}
