// Walk the real tab order, and answer the only question that matters about a
// focus ring: when this control is focused, does anything on screen change?
//
// The order is walked by pressing Tab and asking the document what has focus,
// not by querying for focusable selectors -- a control can match every selector
// in the book and still be unreachable because something above it traps.
//
// The indicator is measured by SCREENSHOT DIFF of the whole viewport, not by
// reading `outline` off the focused element, because two controls here
// deliberately draw it somewhere else: a result row takes `outline: none` on the
// link and lights the ROW's ::after frame instead -- a box far larger than the
// link -- and a detail-list link thickens its underline. Both look ringless from
// the element's own computed style, and a diff clipped to the control misses the
// row frame entirely. Whole viewport, so wherever the mark is drawn it counts.
//
// Also reads the header's height at the top of the page and scrolled down. The
// masthead shrinks on a scroll-progress timeline; tools/probe/header.mjs is the
// full reading of that, this one is a spot check beside the tab walk.
//
// Usage: node tools/probe/keyboard.mjs [origin] [path]
import { chromium } from "playwright-core";

const ORIGIN = process.argv[2] ?? "http://127.0.0.1:3000";
const PATHS = process.argv[3] ? [process.argv[3]] : ["/", "/jobs/JR41734"];
const MAX_STOPS = 220;

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  args: ["--no-sandbox"],
});

function describeFocus() {
  const el = document.activeElement;

  if (!el || el === document.body) return null;

  const rect = el.getBoundingClientRect();

  return {
    tag: el.tagName.toLowerCase(),
    cls: (el.getAttribute("class") ?? "").split(" ")[0],
    label:
      el.getAttribute("aria-label") ??
      (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40),
    onScreen: rect.top >= 0 && rect.bottom <= window.innerHeight && rect.width > 0,
  };
}

// Two PNGs of the same box, differing only in whether the control has focus.
async function differs(page) {
  const focused = await page.screenshot();
  await page.evaluate(() => document.activeElement.blur());
  const blurred = await page.screenshot();
  return page.evaluate(
    ([a, b]) =>
      Promise.all(
        [a, b].map(
          (bytes) =>
            new Promise((resolve) => {
              const image = new Image();
              image.onload = () => {
                const surface = document.createElement("canvas");
                surface.width = image.width;
                surface.height = image.height;
                const context = surface.getContext("2d");
                context.drawImage(image, 0, 0);
                resolve(context.getImageData(0, 0, image.width, image.height).data);
              };
              image.src = `data:image/png;base64,${bytes}`;
            }),
        ),
      ).then(([one, two]) => {
        let changed = 0;
        for (let i = 0; i < one.length; i += 4) {
          if (Math.abs(one[i] - two[i]) > 8) changed += 1;
        }
        return changed;
      }),
    [focused.toString("base64"), blurred.toString("base64")],
  );
}

for (const path of PATHS) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(ORIGIN + path, { waitUntil: "networkidle" });

  const header = await page.evaluate(async () => {
    const height = () =>
      Math.round(document.querySelector(".site-header").getBoundingClientRect().height);
    const top = height();
    window.scrollTo(0, 600);
    // Two frames. A scroll-progress timeline updates with the frame, so reading
    // straight after scrollTo reports the height the header had BEFORE the
    // scroll -- which is how this probe once reported a header that never
    // resized.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return { top, scrolled: height() };
  });
  await page.evaluate(() => window.scrollTo(0, 0));

  const stops = [];
  const unmarked = [];
  let previous = "";

  for (let i = 0; i < MAX_STOPS; i += 1) {
    await page.keyboard.press("Tab");
    const stop = await page.evaluate(describeFocus);
    if (!stop) break;

    const key = `${stop.tag}.${stop.cls}|${stop.label}`;
    if (stops.length > 3 && key === previous) break;
    previous = stops.length === 0 ? key : previous;
    stops.push(stop);

    if (stop.onScreen) {
      const changed = await differs(page);
      if (changed < 40) unmarked.push({ ...stop, changed });
      // Blurring to take the second shot lost the place in the order; put it
      // back by refocusing the element the walk is on.
      await page.evaluate(
        (n) => {
          const all = [...document.querySelectorAll("a,button,input,summary,[tabindex]")];
          const el = all.filter((e) => e.tabIndex >= 0)[n];
          el?.focus();
        },
        stops.length - 1,
      );
    }
  }

  const groups = stops.reduce((acc, stop) => {
    const key = `${stop.tag}${stop.cls ? "." + stop.cls : ""}`;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`\n=== ${path} ===`);
  console.log(`header height: at top ${header.top}px, scrolled to y=600 ${header.scrolled}px`);
  console.log(`tab stops reached: ${stops.length}`);
  console.log(`controls by kind: ${JSON.stringify(groups)}`);
  console.log(`stops measured on screen with NO visible change on focus: ${unmarked.length}`);
  unmarked.forEach((stop) =>
    console.log(`   ${stop.tag}.${stop.cls} "${stop.label}" -- ${stop.changed}px changed`),
  );

  await page.close();
}

await browser.close();
