import { defineConfig } from '@playwright/test';

// `E2E_PORT=4180 npm run e2e` avoids reusing a stale preview server left on 4173 (it would test old code).
const port = Number(process.env.E2E_PORT ?? 4173);

export default defineConfig({
  testDir: 'tests/e2e',
  webServer: {
    command: `npm run build && npx vite preview --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: { baseURL: `http://localhost:${port}` },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
