// Does a full-bleed element actually reach the edges of the page, and does it
// overshoot them?
//
// Written for the home masthead's divider, which is .masthead's own
// border-block-end and therefore exactly as wide as .masthead is. Two readings,
// because they fail in opposite directions:
//
//   1. plain, at three widths -- is the band the full width of the page, or
//      still the width of the content column?
//   2. with `scrollbar-gutter: stable` -- the case 100vw gets wrong.
//
// The second one needs the forcing. Headless Chromium uses overlay scrollbars,
// which take no layout width, so a 100vw bleed measures correct there and only
// misbehaves on a desktop with classic scrollbars. Reserving the gutter
// reproduces it: window.innerWidth stays put while every layout box under it
// gives up the strip, and a box sized from the viewport does not.
//
// Usage: node tools/probe/bleed.mjs [url] [selector]
import { chromium } from "playwright-core";

const URL_UNDER_TEST = process.argv[2] ?? "http://127.0.0.1:3100/?country=us";
const SELECTOR = process.argv[3] ?? ".masthead";
const WIDTHS = [390, 1280, 1600];

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  args: ["--no-sandbox"],
});

// The page BOX, not documentElement.clientWidth: with the gutter reserved,
// clientWidth still reports the whole viewport in this build while the boxes
// under it have correctly given the strip up.
function measure(selector) {
  const page = document.querySelector(".job-page").getBoundingClientRect();
  const target = document.querySelector(selector).getBoundingClientRect();

  return {
    innerWidth: window.innerWidth,
    pageWidth: Math.round(page.width),
    gutter: Math.round(window.innerWidth - page.width),
    scrollWidth: document.documentElement.scrollWidth,
    x: Math.round(target.x),
    width: Math.round(target.width),
  };
}

async function report(width, gutterStable) {
  const page = await browser.newPage({ viewport: { width, height: 700 } });

  await page.goto(URL_UNDER_TEST, { waitUntil: "networkidle" });

  if (gutterStable) {
    await page.addStyleTag({ content: "html { scrollbar-gutter: stable; }" });
    await page.waitForTimeout(200);
  }

  const out = await page.evaluate(measure, SELECTOR);
  const overhang = out.width - out.pageWidth;

  console.log(
    `${String(width).padStart(4)}px  innerWidth=${out.innerWidth} page=${
      out.pageWidth
    } gutter=${out.gutter}px`,
  );
  console.log(
    `        ${SELECTOR} x=${out.x} w=${out.width} (${(
      (out.width / out.pageWidth) *
      100
    ).toFixed(1)}% of page)  overhang=${overhang}px  scrollWidth=${
      out.scrollWidth
    } (${out.scrollWidth > out.pageWidth ? "HORIZONTAL SCROLL" : "no horizontal scroll"})`,
  );

  await page.close();
}

console.log("overlay scrollbars (nothing reserved)");

for (const width of WIDTHS) {
  await report(width, false);
}

console.log("\nscrollbar-gutter: stable (a classic scrollbar's strip reserved)");
await report(1280, true);

await browser.close();
