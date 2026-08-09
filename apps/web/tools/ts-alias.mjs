// Lets plain `node` load the app's own TypeScript modules.
//
// Node 24 strips types from .ts files with no flag and no build step, so the CSS
// generators can be imported exactly as the app and the test suite import them
// -- one source of truth for the math, no second copy of it living in a build
// script. What Node does NOT know is the two things a bundler does for free:
// the "@/*" -> "./src/*" alias from tsconfig.json, and adding the extension.
// This hook teaches it both, and no more than that.
import { registerHooks } from "node:module";

const SRC = new URL("../src/", import.meta.url);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return {
        url: new URL(`${specifier.slice(2)}.ts`, SRC).href,
        shortCircuit: true,
      };
    }

    return nextResolve(specifier, context);
  },
});
