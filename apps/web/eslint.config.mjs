import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // ESLint 9 does not read .gitignore, so every generated directory has to be
  // named here or the repo lints its own build output. coverage/ is the one that
  // bites: `pnpm test:coverage` is a committed script, so running it leaves
  // instrumented HTML that the next `pnpm lint` walks into and stalls on.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
