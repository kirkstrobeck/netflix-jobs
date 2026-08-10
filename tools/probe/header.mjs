// The masthead shrinks as the page scrolls and settles into a compact bar.
//
// Read at four scroll positions, on both routes: the header's own height, the
// wordmark's height, and whether the bar is still on screen at all. A header
// that shrinks and then scrolls away has not done the job, so `top` is part of
// the reading rather than an afterthought.
//
// Usage: node tools/probe/header.mjs [origin]
import { chromium } from "playwright-core";

const ORIGIN = process.argv[2] ?? "http://127.0.0.1:3000";
const PATHS = ["/", "/jobs/JR41734"];
const AT = [0, 64, 128, 600, 2000];

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  args: ["--no-sandbox"],
});

for (const path of PATHS) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(ORIGIN + path, { waitUntil: "networkidle" });
  console.log(`\n=== ${path} ===`);

  for (const y of AT) {
    const reading = await page.evaluate(async (to) => {
      window.scrollTo(0, to);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const header = document.querySelector(".site-header").getBoundingClientRect();
      const mark = document.querySelector(".site-header .wordmark__mark");
      return {
        scrollY: Math.round(window.scrollY),
        header: +header.height.toFixed(1),
        top: Math.round(header.top),
        mark: +mark.getBoundingClientRect().height.toFixed(1),
        position: getComputedStyle(document.querySelector(".site-header")).position,
      };
    }, y);
    console.log(
      `  scrollY ${String(reading.scrollY).padStart(4)}  header ${String(reading.header).padStart(5)}px  mark ${String(reading.mark).padStart(4)}px  top ${String(reading.top).padStart(3)}  ${reading.position}`,
    );
  }

  await page.close();
}

await browser.close();
