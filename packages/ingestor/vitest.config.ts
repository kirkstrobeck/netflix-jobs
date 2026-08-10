import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.ts', 'bin/**/*.ts'],
      // *.harness.ts is shared test setup, not shipped code.
      exclude: ['**/*.test.ts', '**/*.harness.ts'],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
      // skipFull off, so the table lists every measured file rather than only
      // the ones with a hole in them. At 100% the short table is empty, which
      // reads identically to no coverage at all.
      reporter: [['text', { skipFull: false }], 'html'],
    },
  },
});
