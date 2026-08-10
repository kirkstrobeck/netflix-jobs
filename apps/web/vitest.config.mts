import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // cache-headers and next.config sit beside the app rather than under src/,
    // and they are shipped behaviour -- the HTTP policy and the /jobs redirect --
    // so their tests live beside them and are collected the same way.
    include: ["src/**/*.test.{ts,tsx}", "*.test.ts"],
    // Benchmarks measure the real board off the local Supabase stack, so they
    // are not part of the suite, and not part of what the suite has to cover.
    benchmark: { include: ["src/**/*.bench.ts"] },
    css: false,
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}", "cache-headers.ts", "next.config.ts"],
      // Only the suite's own files and the things that build it. Every module
      // the app serves is measured; see vitest.setup.ts for the one file here
      // that has to be excluded because coverage cannot observe itself running.
      exclude: ["**/*.test.{ts,tsx}", "src/**/*.bench.ts", "vitest.setup.ts"],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
      // skipFull off, so the table lists every measured file rather than only
      // the ones with a hole in them. At 100% the short table is empty, which
      // reads identically to no coverage at all.
      reporter: [["text", { skipFull: false }], "html"],
    },
  },
});
