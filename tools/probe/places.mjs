// Does the Locations list on a role page hang its indent, and are its markers
// red squares?
//
// A wrapping item is the whole question. `list-style-position: inside` puts the
// marker in the content box as the first inline box of line one, so line two
// starts at the content edge -- to the LEFT of the marker. Outside leaves the
// content box where it is on every line. The test is arithmetic on client
// rects: the x of line one and the x of line two must be equal.
//
// The lines are read off Range rects rather than the element box, because the
// element box is one rect spanning both lines and says nothing about either.
//
// The visually-hidden run is skipped. Each link carries a <span
// class="visually-hidden"> roles</span> for the screen reader, and it is clipped
// rather than removed -- so it still has a box, at 1px, wherever the clip puts
// it. Ranged over, it reports a line that is not on screen.
import { chromium } from "playwright-core";

const URL_UNDER_TEST = process.argv[2] ?? "http://localhost:3000/jobs/JR39786";
const WIDTH = Number(process.argv[3] ?? 390);
const LIST = process.argv[4] ?? ".detail-places";
const ITEM = `${LIST} > li`;

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: WIDTH, height: 1400 } });

await page.goto(URL_UNDER_TEST, { waitUntil: "networkidle" });
await page.waitForSelector(LIST);

console.log("url     :", URL_UNDER_TEST);
console.log("viewport:", WIDTH);
console.log("list    :", LIST);

// 1. THE COMPUTED VALUES, off the live cascade.
const computed = await page.locator(LIST).first().evaluate((el) => {
  const list = getComputedStyle(el);
  const item = el.querySelector("li") ?? el;
  const marker = getComputedStyle(item, "::marker");

  return {
    "list-style-position": list.listStylePosition,
    "list-style-type": list.listStyleType,
    "padding-inline-start": list.paddingInlineStart,
    "::marker color": marker.color,
    "::marker content-type": getComputedStyle(item).listStyleType,
    "--accent": getComputedStyle(el).getPropertyValue("--accent").trim(),
  };
});

console.log("\n-- computed --");
for (const [k, v] of Object.entries(computed)) console.log(`${k.padEnd(22)}: ${v}`);

// 2. LINE RECTS, per item. A Range over the item's text, walked character by
// character, gives one rect per line box; their x values are the answer.
const lines = await page.locator(ITEM).evaluateAll((items) =>
  items.map((li) => {
    const walker = document.createTreeWalker(li, NodeFilter.SHOW_TEXT);
    const rects = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.parentElement.closest(".visually-hidden")) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      rects.push(...range.getClientRects());
    }

    // Client rects of a range are per line box, deduped on y so a run broken
    // across inline elements does not report the same line twice.
    const seen = new Map();
    for (const r of rects) {
      if (r.width === 0) continue;
      const key = Math.round(r.top);
      const prev = seen.get(key);
      if (!prev || r.left < prev.left) seen.set(key, r);
    }

    return {
      text: li.innerText.replace(/\s+/g, " ").trim(),
      marker: li.getBoundingClientRect().left,
      content: [...seen.values()]
        .sort((a, b) => a.top - b.top)
        .map((r) => ({ x: Math.round(r.left * 100) / 100, y: Math.round(r.top) })),
    };
  }),
);

console.log("\n-- line boxes (x per line) --");
for (const item of lines) {
  console.log(`\nitem: ${JSON.stringify(item.text)}`);
  console.log(`  li box left (marker hangs left of this): ${item.marker}`);
  item.content.forEach((line, i) => console.log(`  line ${i + 1} x = ${line.x}   (y ${line.y})`));

  const xs = item.content.map((line) => line.x);
  if (xs.length > 1) {
    const equal = xs.every((x) => x === xs[0]);
    console.log(`  WRAPS. all lines equal x? ${equal ? "YES" : "NO -> " + xs.join(" != ")}`);
  }
}

// 3. THE BLOCK, at the width the numbers were taken at. The whole row, so the
// 'Locations' term is in frame above the list -- the item alignment is only
// legible against something.
const row = page
  .locator(".detail-list__row")
  .filter({ has: page.locator(LIST) })
  .first();
await row.scrollIntoViewIfNeeded();
await row.screenshot({ path: `/tmp/places-${WIDTH}.png` });
console.log(`\nshot: /tmp/places-${WIDTH}.png`);

await browser.close();
