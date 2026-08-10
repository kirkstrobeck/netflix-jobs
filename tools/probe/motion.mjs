// Do the decorative effects hold their frame rate, and do they actually stop
// when nobody can see them?
//
// Both are claims about running code that no stylesheet can make on its own. The
// bars and the glow are pure CSS keyframes -- `transform: translate3d(...)` for
// the bars, the `translate` property plus `opacity` for the glow -- so the
// interesting question is not whether they animate but what they cost, and
// whether the IntersectionObserver in pause-when-idle.ts really parks them.
//
// Frames are counted with requestAnimationFrame over a fixed window, which
// measures the page's actual presented rate. The pause is read off the class the
// stylesheets key on, and confirmed against the computed animation-play-state of
// a real animated element -- the class is the mechanism, play-state is the
// effect.
//
// Usage: node tools/probe/motion.mjs [origin] [path]
import { chromium } from "playwright-core";

const ORIGIN = process.argv[2] ?? "http://127.0.0.1:3000";
const PATHS = process.argv[3] ? [process.argv[3]] : ["/", "/jobs/JR41734"];
const SAMPLE_MS = 3000;

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  args: ["--no-sandbox"],
});

function countFrames(ms) {
  return new Promise((resolve) => {
    let frames = 0;
    const started = performance.now();
    const tick = () => {
      frames += 1;
      if (performance.now() - started < ms) {
        requestAnimationFrame(tick);
        return;
      }
      resolve({ frames, elapsed: Math.round(performance.now() - started) });
    };
    requestAnimationFrame(tick);
  });
}

function readMotion() {
  const region = (selector) => {
    const el = document.querySelector(selector);
    if (!el) return null;
    // The element the keyframes are actually ON: .bars__mover inside each bar,
    // and .glow__orb itself. Reading play-state off their containers reports
    // "running" forever, because containers carry no animation.
    const animated = el.querySelector(".bars__mover, .glow__orb");
    return {
      idle: el.classList.contains("is-idle"),
      playState: animated ? getComputedStyle(animated).animationPlayState : null,
      children: el.querySelectorAll("*").length,
    };
  };

  return { bars: region(".bars"), glow: region(".glow") };
}

for (const path of PATHS) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(ORIGIN + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  console.log(`\n=== ${path} ===`);

  // At the top of the page: the bars are on screen, the footer glow is not.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  console.log("at top of page:   ", JSON.stringify(await page.evaluate(readMotion)));

  const top = await page.evaluate(countFrames, SAMPLE_MS);
  console.log(
    `  frames ${top.frames} in ${top.elapsed}ms = ${(top.frames / (top.elapsed / 1000)).toFixed(1)} fps`,
  );

  // At the bottom: the glow is on screen, the masthead bars are not.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(600);
  console.log("at bottom of page:", JSON.stringify(await page.evaluate(readMotion)));

  const bottom = await page.evaluate(countFrames, SAMPLE_MS);
  console.log(
    `  frames ${bottom.frames} in ${bottom.elapsed}ms = ${(bottom.frames / (bottom.elapsed / 1000)).toFixed(1)} fps`,
  );

  await page.close();
}

await browser.close();
