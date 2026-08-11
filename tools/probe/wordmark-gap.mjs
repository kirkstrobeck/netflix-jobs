// The gap between the wordmark's mark and its JOBS suffix, as the header closes.
//
// THE BUG THIS MEASURES. .site-header .wordmark__mark animates `scale`, and
// scale paints from the centre of the box without changing it. The layout box
// stays 87px wide while the artwork inside it shrinks to 67px, so the mark's
// PAINTED right edge walks left by half the difference and the suffix -- laid
// out against the box, not the paint -- stays exactly where it was. The gap the
// eye sees therefore grows by that half difference over the scroll range, while
// every box in the row reports no movement at all.
//
// So the numbers that matter are painted edges, not offsetWidth: getBoundingClientRect
// on the <img> reflects the scale, and on the suffix reflects its translate.
// Reading either from the layout box would report a constant and miss the bug.
//
// Usage: node tools/probe/wordmark-gap.mjs [origin] [path]
import { chromium } from "playwright-core";

const ORIGIN = process.argv[2] ?? "http://127.0.0.1:3103";
const PATH = process.argv[3] ?? "/jobs/JR40365";

// 0 is the resting state, 128 is 8rem -- the end of animation-range, so full
// shrink -- and 64 is the midpoint, which is where a translate that is applied
// on the wrong curve shows up. 600 is well past the range: `both` should hold
// the end value there, so 600 and 128 must agree exactly.
const SCROLLS = [0, 64, 128, 600];

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.goto(ORIGIN + PATH, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);

console.log(`${ORIGIN}${PATH}   viewport 1280x900\n`);
console.log(
  ["scrollY", "markRight", "suffixLeft", "gap", "markW", "scale", "translate"]
    .map((h, i) => h.padEnd([9, 11, 12, 9, 9, 11, 11][i]))
    .join(""),
);

for (const y of SCROLLS) {
  await page.evaluate((to) => window.scrollTo(0, to), y);

  // Two frames: one for the scroll to commit, one for the progress timeline to
  // sample it. Reading straight after scrollTo reports the previous frame.
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );

  const seen = await page.evaluate(() => {
    const mark = document.querySelector(".site-header .wordmark__mark");
    const suffix = document.querySelector(".site-header .wordmark__suffix");
    const markBox = mark.getBoundingClientRect();
    const suffixBox = suffix.getBoundingClientRect();

    return {
      markRight: Math.round(markBox.right * 100) / 100,
      suffixLeft: Math.round(suffixBox.left * 100) / 100,
      markWidth: Math.round(markBox.width * 100) / 100,
      scale: getComputedStyle(mark).scale,
      translate: getComputedStyle(suffix).translate,
    };
  });

  console.log(
    [
      String(y).padEnd(9),
      seen.markRight.toFixed(2).padEnd(11),
      seen.suffixLeft.toFixed(2).padEnd(12),
      (seen.suffixLeft - seen.markRight).toFixed(2).padEnd(9),
      seen.markWidth.toFixed(2).padEnd(9),
      seen.scale.padEnd(11),
      seen.translate,
    ].join(""),
  );
}

await browser.close();
