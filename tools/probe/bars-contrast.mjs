// The headline's contrast over the bars, DERIVED rather than remembered.
//
// This exists because the number rotted once already. The comments in
// home-masthead.tsx and home-masthead.css said 6.28:1 and rgb(183,8,16) long
// after BAR_ALPHA moved from 0.10 to 0.15, and nothing anywhere recomputed it --
// it is a public accessibility claim on /about, so "it was true when written" is
// not good enough.
//
// Every input is read off the files that define it: the alpha, the colour and
// the count out of _bars/bars-tunables.ts, --surface and --ink out of
// job-shell.css. Change either file and this prints the new answer.
//
// WHAT "THE WORST FRAME" MEANS. The bars are one flat alpha each over --surface,
// so N of them stacked on the same pixel composite to
//   1 - (1 - alpha)^N
// of the bar colour. N = BAR_COUNT is the CEILING: it assumes all fifteen bars
// overlap the same pixel, which the walk never actually reaches. The eight-bar
// figure beside it is the worst a full sweep of the loop was measured at.
//
// Usage: node tools/probe/bars-contrast.mjs
import { readFileSync } from "node:fs";

import { contrast, hex } from "./contrast.mjs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const TUNABLES = read("../../apps/web/src/app/_bars/bars-tunables.ts");
const SHELL = read("../../apps/web/src/app/(site)/job-shell.css");

const constant = (name) => {
  const match = TUNABLES.match(new RegExp(`export const ${name} = ([^;]+);`));

  if (!match) {
    throw new Error(`${name} not found in bars-tunables.ts`);
  }

  return match[1].replaceAll('"', "").trim();
};

const token = (name) => {
  const match = SHELL.match(new RegExp(`--${name}:\\s*([^;]+);`));

  if (!match) {
    throw new Error(`--${name} not found in job-shell.css`);
  }

  return match[1].trim();
};

const fromHex = (value) => [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16));

const BAR_RGB = constant("BAR_RGB").split(/\s+/).map(Number);
const BAR_ALPHA = Number(constant("BAR_ALPHA"));
const BAR_COUNT = Number(constant("BAR_COUNT"));
const SURFACE = fromHex(token("surface"));
const INK = fromHex(token("ink"));

console.log("INPUTS, read from the files that define them");
console.log(`  BAR_RGB    ${BAR_RGB.join(" ")}        _bars/bars-tunables.ts`);
console.log(`  BAR_ALPHA  ${BAR_ALPHA}                _bars/bars-tunables.ts`);
console.log(`  BAR_COUNT  ${BAR_COUNT}                  _bars/bars-tunables.ts`);
console.log(`  --surface  ${token("surface")} = ${hex(SURFACE)}   (site)/job-shell.css`);
console.log(`  --ink      ${token("ink")} = ${hex(INK)}   (site)/job-shell.css`);

console.log("\nSTACKED BARS OVER --surface, AND --ink AGAINST IT");
console.log("  bars  coverage    backdrop            contrast   AA (4.5:1)");

for (const bars of [BAR_COUNT, 8, 1]) {
  const coverage = 1 - (1 - BAR_ALPHA) ** bars;
  const backdrop = BAR_RGB.map((c, i) => c * coverage + SURFACE[i] * (1 - coverage));
  const ratio = contrast(INK, backdrop);

  console.log(
    [
      String(bars).padStart(6),
      coverage.toFixed(7).padStart(10),
      hex(backdrop).padStart(20),
      (ratio.toFixed(2) + ":1").padStart(11),
      (ratio >= 4.5 ? "  pass" : "  FAIL").padStart(8),
    ].join(""),
  );
}

console.log("\nThe first row is the ceiling the comments and /about must state.");
