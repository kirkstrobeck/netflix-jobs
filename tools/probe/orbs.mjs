// Where the orbs actually are, and whether they are still moving.
//
// The drift is two animations on two elements now -- the frame walks sideways,
// its ::before walks up and down -- and the only thing that proves they compose
// is the painted box of the light itself. This reads that box at chosen times
// and reports the envelope: the highest top edge, the lowest, and how far the
// field spreads across the band.
//
// Usage: node tools/probe/orbs.mjs [url] [samples]
import { chromium } from "playwright-core";

const URL_UNDER_TEST = process.argv[2] ?? "http://127.0.0.1:3000/?country=US";
const SAMPLES = Number(process.argv[3] ?? 24);
// Past the longest loop in the field, so the envelope is the whole walk.
const SPAN_MS = 70_000;

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.goto(URL_UNDER_TEST, { waitUntil: "networkidle" });
await page.locator(".glow").scrollIntoViewIfNeeded();

const frames = [];

for (let i = 0; i < SAMPLES; i += 1) {
  const time = (SPAN_MS / SAMPLES) * i;

  frames.push(
    await page.evaluate((t) => {
      document.getAnimations().forEach((animation) => {
        if (!(animation.timeline instanceof DocumentTimeline)) {
          return;
        }

        animation.pause();
        animation.currentTime = t;
      });

      const band = document.querySelector(".glow__orbs").getBoundingClientRect();
      // The painted light is the ::before, and a pseudo-element has no box to
      // ask for -- but the frame's own box plus the two transforms is exactly
      // what the browser used to place it, so read that instead: the frame's
      // matrix, times the ::before's, applied to the ::before's static box.
      // `translate`, not `transform` -- these are the individual properties, and
      // `transform` on both of these elements is still none.
      const axes = (value) => {
        const [x, y] = value.split(" ");

        return { x: Number.parseFloat(x) || 0, y: Number.parseFloat(y) || 0 };
      };
      const boxes = [...document.querySelectorAll(".glow__orb")].map((orb) => {
        const seen = getComputedStyle(orb, "::before");
        const frame = axes(getComputedStyle(orb).translate);
        const inner = axes(seen.translate);
        const height = Number.parseFloat(seen.height);

        return {
          // Top edge of the light, in percent of the band, measured up from the
          // band's bottom edge. The static box sits at bottom: 0, so its top is
          // `height` above that before either translation is applied.
          top: ((height - frame.y - inner.y) / band.height) * 100,
          left:
            ((frame.x + inner.x + Number.parseFloat(seen.marginLeft)) / band.width) *
            100,
        };
      });

      return {
        at: Math.round(t / 1000),
        top: Math.max(...boxes.map((b) => b.top)),
        bottom: Math.min(...boxes.map((b) => b.top)),
        left: Math.min(...boxes.map((b) => b.left)),
        right: Math.max(...boxes.map((b) => b.left)),
        moving: boxes.map((b) => Math.round(b.left * 100)).join(),
      };
    }, time),
  );
}

const still = new Set(frames.map((f) => f.moving)).size;

console.log(`${URL_UNDER_TEST}  (${SAMPLES} frames across ${SPAN_MS / 1000}s)`);
console.log(`  distinct arrangements: ${still} of ${SAMPLES}`);

for (const f of frames) {
  console.log(
    `  t=${String(f.at).padStart(3)}s  top edge ${f.bottom.toFixed(1)}..${f.top.toFixed(1)}cqh` +
      `  across ${f.left.toFixed(1)}..${f.right.toFixed(1)}cqw`,
  );
}

await browser.close();
