// What sits between the pager's three tracks, and whether the row moves when a
// control is not rendered.
//
// The pager reserves space for Previous and Next rather than rendering dead
// versions of them, so two things have to be true and neither is visible in the
// stylesheet: the gap on the Previous side has to equal the gap on the Next
// side, and the page numbers have to land in the same place on page one -- where
// there is no Previous -- as they do in the middle of the list.
//
// The first one was false. Equal 5.5rem tracks with each control hugging its own
// label put all the leftover on one side: 9px between Previous and the first
// number, 33px between the last number and Next, at every width. The controls
// fill their tracks now and the gap is a declared column-gap.
//
// Read track to track, not first-child to last-child: at 390 the five numbers
// wrap to two rows, so the first and last <li> sit on different lines and the
// distance between them and the controls is a wrap artifact rather than a gap.
//
// Usage: node tools/probe/pager.mjs [origin]
import { chromium } from "playwright-core";

const ORIGIN = process.argv[2] ?? "http://127.0.0.1:3000";
const WIDTHS = [390, 768, 1280];
// Page one has no Previous, page three has both, and the last page has no Next.
const PAGES = [1, 3, 24];

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  args: ["--no-sandbox"],
});

function measure() {
  const box = (selector) => {
    const el = document.querySelector(selector);
    if (!el) return null;
    const rect = el.getBoundingClientRect();

    return {
      left: Math.round(rect.left),
      right: Math.round(rect.right),
      width: Math.round(rect.width),
    };
  };

  const prev = box(".pager__step--prev");
  const pages = box(".pager__pages");
  const next = box(".pager__step--next");

  return {
    prevWidth: prev?.width ?? null,
    nextWidth: next?.width ?? null,
    pagesLeft: pages?.left ?? null,
    gapPrevToPages: prev && pages ? pages.left - prev.right : null,
    gapPagesToNext: next && pages ? next.left - pages.right : null,
  };
}

for (const width of WIDTHS) {
  for (const page of PAGES) {
    const tab = await browser.newPage({ viewport: { width, height: 900 } });
    await tab.goto(`${ORIGIN}/?page=${page}`, { waitUntil: "networkidle" });
    await tab.waitForSelector(".pager", { timeout: 15000 });
    console.log(width, `page=${page}`, JSON.stringify(await tab.evaluate(measure)));
    await tab.close();
  }
}

await browser.close();
