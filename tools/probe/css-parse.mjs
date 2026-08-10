// What a stylesheet costs the main thread before anything can paint.
//
// The transfer is not the interesting number for a generated sheet on a fast
// connection -- 156KB arrives in about two milliseconds over localhost. What the
// document actually waits for is the engine parsing it and building a keyframe
// model per @keyframes block, and that is what this measures: the sheet is
// handed to a blank page as a <style>, and the clock stops when the style
// engine has finished with it.
//
// Usage: node tools/probe/css-parse.mjs <file> [<file> ...] [--runs=N]
import { readFileSync } from "node:fs";

import { chromium } from "playwright-core";

const RUNS = Number((process.argv.find((a) => a.startsWith("--runs=")) ?? "=9").split("=")[1]);
const FILES = process.argv.slice(2).filter((a) => !a.startsWith("--"));

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  args: ["--no-sandbox"],
});

for (const file of FILES) {
  const css = readFileSync(file, "utf8");
  const times = [];

  for (let run = 0; run < RUNS; run += 1) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

    // A live subtree the sheet actually matches, so the cost includes style
    // resolution and not only the parse.
    await page.setContent(
      `<div class="glow"><div class="glow__wash"></div><div class="glow__orbs">${Array.from(
        { length: 100 },
        (_, i) => `<div class="glow__orb glow__orb--${i}"></div>`,
      ).join("")}</div></div>`,
    );

    times.push(
      await page.evaluate((text) => {
        const style = document.createElement("style");
        style.textContent = text;

        const start = performance.now();

        document.head.append(style);
        // Forces the engine to finish: a layout read cannot be answered until
        // the new sheet has been parsed and the cascade recomputed.
        document.body.getBoundingClientRect();
        getComputedStyle(document.querySelector(".glow__orb--99")).translate;

        return performance.now() - start;
      }, css),
    );

    await page.close();
  }

  const sorted = [...times].sort((a, b) => a - b);
  const stops = (css.match(/^ +[\d.]+% \{/gm) ?? []).length;

  console.log(
    `${file}\n` +
      `  ${css.length} bytes, ${(css.match(/@keyframes/g) ?? []).length} keyframe blocks, ${stops} stops\n` +
      `  parse + resolve over ${RUNS} runs: median ${sorted[Math.floor(RUNS / 2)].toFixed(1)}ms  ` +
      `min ${sorted[0].toFixed(1)}ms  max ${sorted[RUNS - 1].toFixed(1)}ms\n` +
      `  raw: ${sorted.map((t) => t.toFixed(1)).join(", ")}`,
  );
}

await browser.close();
