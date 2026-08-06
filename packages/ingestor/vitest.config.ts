import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.ts', 'bin/**/*.ts'],
      // *.harness.ts is shared test setup, not shipped code.
      exclude: ['**/*.test.ts', '**/*.harness.ts'],
      // Everything reachable is covered. The thresholds sit at the achieved
      // numbers rather than a flat 100 so the suite stays green while still
      // failing on any regression. What keeps them off 100:
      //
      //   lib/db.ts:67          `init.method ?? 'GET'` — dead, every caller
      //                         passes an explicit method.
      //   lib/http.ts:26        `?? 120_000` — dead, fetchJson throws once
      //                         rateLimit.hits passes RATE_LIMIT_DELAYS_MS.
      //   lib/transport.ts:176  the implicit else of `if (transport ===
      //                         'direct')`. The reader path does run it; the
      //                         v8 provider cannot attribute the branch.
      //   bin/ingest.ts:166-167 the `import.meta.url` auto-run guard, left
      //                         unexercised so no test can really exit.
      thresholds: {
        lines: 99.62,
        functions: 100,
        branches: 97.88,
        statements: 99.66,
      },
    },
  },
});
