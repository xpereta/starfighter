import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: { outDir: 'dist' },
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'tests/e2e'],
  },
});
