// Shared by the style tools: starts a Vite dev server for the repo and a headless Chromium with
// software GL, opens the style lab page (scripts/style-lab) and hands over the page.
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

/**
 * Runs `fn(page)` on the style lab. `port` must not be one a dev server or preview already uses
 * (the tools take `--port=`); the lab is served by Vite from the repo root, nothing is built.
 */
export async function withLab(port, fn, viewport = { width: 1600, height: 1000 }) {
  const server = await createServer({
    configFile: false,
    root: process.cwd(),
    logLevel: 'error',
    server: { port, strictPort: true, host: '127.0.0.1' },
    // The lab imports the game's own TypeScript; no build, no HMR socket needed.
    optimizeDeps: { entries: ['scripts/style-lab/index.html'] },
  });
  await server.listen();
  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  try {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${port}/scripts/style-lab/index.html`);
    await page.waitForFunction(() => window.lab !== undefined, null, { timeout: 60_000 });
    const result = await fn(page);
    if (errors.length) console.warn(`console errors in the lab page:\n${errors.join('\n')}`);
    return result;
  } finally {
    await browser.close();
    await server.close();
  }
}

/** `--name=value` flag or a fallback. */
export function flag(args, name, fallback) {
  return args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
}
