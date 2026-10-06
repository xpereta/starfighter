// One headless screenshot: `node scripts/spectacle-one.mjs "<query>" <out.png> [waitMs] [WxH] [demo]`.
// Needs a running preview (`npm run build && npx vite preview --port 4190`). Screenshot mode (K) is on.
import { chromium } from '@playwright/test';

const [query, out, wait = '2500', size = '960x600', demo = ''] = process.argv.slice(2);
const [w, h] = size.split('x').map(Number);
const browser = await chromium.launch({
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
  ],
});
const page = await browser.newPage({ viewport: { width: w, height: h } });
page.on('console', (m) => m.type() === 'error' && console.log('console error:', m.text()));
page.on('pageerror', (e) => console.log('page error:', e.message));
await page.goto(`http://localhost:${process.env.PORT ?? 4190}/?${query}`);
await page.waitForSelector('canvas');
await page.keyboard.press('k');
await page.waitForTimeout(Number(wait));
if (demo) {
  await page.evaluate(() => globalThis.__sfDemo());
  await page.waitForTimeout(Number(demo));
}
await page.screenshot({ path: out });
await browser.close();
