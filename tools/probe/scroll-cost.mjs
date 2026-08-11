// What one scroll of the listing page costs the main thread.
//
// A scroll-driven animation is supposed to be free: the compositor reads the
// scroll offset it already has and moves a layer it already has. That is only
// true of compositor properties. Animate a LAYOUT property on a scroll timeline
// -- min-block-size on an in-flow sticky header, say -- and every scroll frame
// re-lays-out the document under it, on the main thread, at the moment that
// thread is busiest. The difference is not visible in a screenshot and it is not
// visible in a frame counter that only ever sees a lightly loaded machine. It is
// visible in LayoutCount.
//
// So: read Chrome's Performance counters, scroll the root scroller 0 -> 2000px
// one step per animation frame, read the counters again. LayoutCount is the
// number that proves it -- a compositor-only header leaves it flat, and one
// layout per scrolled frame leaves it tracking the step count. The frame deltas
// beside it say what that cost the presented rate.
//
// Usage: node tools/probe/scroll-cost.mjs [url] [runs]
import { chromium } from "playwright-core";

const URL_UNDER_TEST = process.argv[2] ?? "http://127.0.0.1:3100/?country=US";
const RUNS = Number(process.argv[3] ?? 3);
const STEPS = 100;
const DISTANCE = 2000;
const FRAME_BUDGET_MS = 16.7;

// The counters worth naming. Performance.getMetrics returns several dozen; these
// four are the layout and style story, and Duration is in seconds.
const COUNTERS = [
  "LayoutCount",
  "LayoutDuration",
  "RecalcStyleCount",
  "RecalcStyleDuration",
];

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  args: ["--no-sandbox"],
});

function readMetrics(metrics) {
  return Object.fromEntries(
    metrics.filter((m) => COUNTERS.includes(m.name)).map((m) => [m.name, m.value]),
  );
}

// One step per animation frame, and the frame's own timestamp recorded with it.
// Not a smooth-scroll and not a wheel event: those hand the pacing to the
// browser, and the point is a fixed number of scroll positions so two runs are
// comparable. scrollTo inside rAF lands the offset before that frame's style and
// layout, so a layout it provokes is charged to that frame.
function scrollAndTime({ steps, distance }) {
  return new Promise((resolve) => {
    const stamps = [];
    let step = 0;

    const tick = (now) => {
      stamps.push(now);
      step += 1;

      if (step > steps) {
        resolve(stamps);
        return;
      }

      document.scrollingElement.scrollTop = (distance * step) / steps;
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  });
}

function summarise(stamps) {
  const deltas = stamps.slice(1).map((t, i) => t - stamps[i]);
  const sorted = [...deltas].sort((a, b) => a - b);

  return {
    frames: deltas.length,
    mean: deltas.reduce((n, d) => n + d, 0) / deltas.length,
    p95: sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)],
    over: deltas.filter((d) => d > FRAME_BUDGET_MS).length,
  };
}

async function run() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);

  await page.goto(URL_UNDER_TEST, { waitUntil: "load" });
  // Settle: the footer glow arrives through next/dynamic after hydration, and a
  // reading taken before it lands is a reading of a different page.
  await page.waitForFunction(() => document.querySelector(".glow__orb") !== null);
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    document.scrollingElement.scrollTop = 0;
  });
  await page.waitForTimeout(300);

  await cdp.send("Performance.enable");
  const before = readMetrics((await cdp.send("Performance.getMetrics")).metrics);

  const stamps = await page.evaluate(scrollAndTime, { steps: STEPS, distance: DISTANCE });

  const after = readMetrics((await cdp.send("Performance.getMetrics")).metrics);
  const height = await page.evaluate(() => document.scrollingElement.scrollHeight);

  await context.close();

  return {
    height,
    deltas: Object.fromEntries(COUNTERS.map((name) => [name, after[name] - before[name]])),
    frames: summarise(stamps),
  };
}

function report(result, label) {
  const d = result.deltas;

  console.log(`\n--- ${label} ---`);
  console.log(`  scrollHeight            ${result.height}px`);
  console.log(`  LayoutCount             ${d.LayoutCount}`);
  console.log(`  LayoutDuration          ${(d.LayoutDuration * 1000).toFixed(2)}ms`);
  console.log(`  RecalcStyleCount        ${d.RecalcStyleCount}`);
  console.log(`  RecalcStyleDuration     ${(d.RecalcStyleDuration * 1000).toFixed(2)}ms`);
  console.log(`  frames                  ${result.frames.frames}`);
  console.log(`  frame delta mean        ${result.frames.mean.toFixed(2)}ms`);
  console.log(`  frame delta p95         ${result.frames.p95.toFixed(2)}ms`);
  console.log(`  frames over ${FRAME_BUDGET_MS}ms      ${result.frames.over}`);
}

console.log(`${URL_UNDER_TEST}  ${STEPS} steps to ${DISTANCE}px, ${RUNS} runs`);

const results = [];

for (let i = 0; i < RUNS; i += 1) {
  results.push(await run());
}

for (const [i, result] of results.entries()) {
  report(result, `run ${i + 1}`);
}

const counts = results.map((r) => r.deltas.LayoutCount);
const median = [...results].sort((a, b) => a.deltas.LayoutCount - b.deltas.LayoutCount)[
  Math.floor(results.length / 2)
];

console.log(`\nLayoutCount across runs: ${counts.join(", ")}`);
report(median, "median run, in full");

await browser.close();
