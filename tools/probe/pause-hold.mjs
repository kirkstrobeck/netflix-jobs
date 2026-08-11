// Do the decorative effects REALLY stop when nobody can see them, and do they
// really carry on from where they stopped?
//
// /about makes both claims in prose. pause-when-idle.test.tsx proves only that
// the class lands on the element, with a fake IntersectionObserver; the
// stylesheets are asserted as text. Neither runs a browser, so neither can say
// whether the animation actually parked.
//
// currentTime on the animation itself is the reading that can. It is the clock
// the effect is being played against, so:
//
//   off screen   two samples 600ms apart must be EQUAL. Anything else is an
//                animation that is still running where nobody can see it.
//   on screen    the same two samples must DIFFER.
//   returning    the value after scrolling back must carry on from the one it
//                held while away, not restart near zero -- which is the
//                difference between animation-play-state and animation: none.
//
// The orbs animate on the element AND on its ::before, so animations are read
// with { subtree: true } and the pseudo is reported beside its host.
//
// Usage: node tools/probe/pause-hold.mjs [url]
import { chromium } from "playwright-core";

const URL_UNDER_TEST = process.argv[2] ?? "http://127.0.0.1:3100/?country=US";
const GAP_MS = 600;

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  args: ["--no-sandbox"],
});

// The two elements the keyframes are actually on. Their containers carry no
// animation, so reading either of those reports nothing at all.
const TARGETS = [
  { label: "bars  .bars__mover--0", selector: ".bars__mover--0", region: ".bars" },
  { label: "glow  .glow__orb--0", selector: ".glow__orb--0", region: ".glow" },
];

function sample(selector) {
  const element = document.querySelector(selector);
  const region = element.closest(".bars, .glow");
  const box = element.getBoundingClientRect();

  return {
    idle: region.classList.contains("is-idle"),
    onScreen: box.bottom > 0 && box.top < window.innerHeight,
    playState: getComputedStyle(element).animationPlayState,
    times: element.getAnimations({ subtree: true }).map((animation) => ({
      on: animation.effect.pseudoElement ?? "element",
      currentTime: +Number(animation.currentTime).toFixed(3),
    })),
  };
}

async function twice(page, selector) {
  const first = await page.evaluate(sample, selector);
  await page.waitForTimeout(GAP_MS);
  const second = await page.evaluate(sample, selector);

  return { first, second };
}

function show(label, { first, second }) {
  const pairs = first.times.map((entry, i) => {
    const later = second.times[i];
    const moved = later.currentTime !== entry.currentTime;

    return `      ${entry.on.padEnd(9)} ${String(entry.currentTime).padStart(11)} -> ` +
      `${String(later.currentTime).padStart(11)}   ${moved ? "MOVED" : "held"}`;
  });

  console.log(
    `    ${label}  idle=${first.idle}  onScreen=${first.onScreen}  ` +
      `play-state=${first.playState}`,
  );
  console.log(pairs.join("\n"));
}

const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.goto(URL_UNDER_TEST, { waitUntil: "load" });
// The footer glow arrives through next/dynamic, so it does not exist until
// after hydration. Waiting on the orb is waiting on that.
await page.waitForFunction(() => document.querySelector(".glow__orb--0") !== null);
await page.waitForTimeout(800);

const top = () => page.evaluate(() => {
  document.scrollingElement.scrollTop = 0;
});
const bottom = () => page.evaluate(() => {
  document.scrollingElement.scrollTop = document.scrollingElement.scrollHeight;
});

console.log(`${URL_UNDER_TEST}   two samples ${GAP_MS}ms apart\n`);

for (const target of TARGETS) {
  // The bars live at the top of the page and the glow at the bottom, so one
  // scroll position puts each of them off screen and the other puts it on.
  const away = target.selector.includes("bars") ? bottom : top;
  const toward = target.selector.includes("bars") ? top : bottom;

  console.log(`  ${target.label}`);

  await away();
  await page.waitForTimeout(700);
  const off = await twice(page, target.selector);
  show("OFF SCREEN", off);

  await toward();
  await page.waitForTimeout(700);
  show("ON SCREEN ", await twice(page, target.selector));

  // Away again, then back: the value on return has to continue from the one it
  // held while it was away.
  await away();
  await page.waitForTimeout(700);
  const parked = await page.evaluate(sample, target.selector);
  await page.waitForTimeout(1500);
  await toward();
  await page.waitForTimeout(120);
  const resumed = await page.evaluate(sample, target.selector);

  console.log("    RESUME");
  for (const [i, entry] of parked.times.entries()) {
    console.log(
      `      ${entry.on.padEnd(9)} parked at ${String(entry.currentTime).padStart(11)}` +
        `  ->  back at ${String(resumed.times[i].currentTime).padStart(11)}`,
    );
  }

  console.log("");
}

await browser.close();
