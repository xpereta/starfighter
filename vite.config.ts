import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: { outDir: 'dist' },
  test: {
    environment: 'node',
    // The simulation tests run minutes of game time; CI machines are slower than a laptop and run files in parallel.
    testTimeout: 60_000,
    include: ['**/*.test.ts'],
    // .claude/worktrees holds temporary git worktrees of parallel agents: never run their copies of the tests.
    exclude: ['node_modules', 'dist', 'tests/e2e', '.claude/worktrees/**'],
  },
});
