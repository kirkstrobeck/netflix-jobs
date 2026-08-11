// THE WRAP AUDIT. Which text on this site actually wraps, and how ragged is it.
//
// Runs the same sweep every time -- three pages, two widths -- so the run before
// a change and the run after it are comparable line for line. Writes a JSON
// snapshot as well as the table, and wrap-diff.mjs puts two snapshots side by
// side.
//
// Usage:
//   node tools/probe/wrap.mjs [origin] [out.json]
//
// The measurement itself, and the definition of raggedness, are in
// wrap-lines.mjs. This file is the driver and the report.
//
// WHY 390 AND 1280
//
// The same two widths every other probe in here uses: 390 is the narrow phone
// the Lighthouse mobile run emulates, 1280 the desktop one. A rule that helps at
// one and hurts at the other is a rule that has not been decided yet, which is
// exactly what the table is for.
import { writeFileSync } from "node:fs";

import { chromium } from "playwright-core";

import { collectWraps } from "./wrap-lines.mjs";

const ORIGIN = process.argv[2] ?? "http://127.0.0.1:3103";
const OUT = process.argv[3] ?? "/tmp/wrap.json";

// The listing is fetched with the country already in the URL. Left to redirect,
// the probe would measure the 307's target on a second navigation and the run
// would be one page-load slower for no difference in what it reads.
const PAGES = [
  { name: "listing", path: "/?country=us" },
  { name: "role", path: "/jobs/JR40365" },
  { name: "about", path: "/about" },
];

const WIDTHS = [390, 1280];

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  args: ["--no-sandbox"],
});

const snapshot = [];

for (const width of WIDTHS) {
  const page = await browser.newPage({ viewport: { width, height: 1400 } });

  for (const target of PAGES) {
    await page.goto(ORIGIN + target.path, { waitUntil: "networkidle" });

    // The webfonts are the whole measurement. Read before they land, every line
    // box is the fallback's width and the numbers describe Arial.
    await page.evaluate(() => document.fonts.ready);

    const found = await page.evaluate(collectWraps);

    found.forEach((item) => snapshot.push({ page: target.name, width, ...item }));
  }

  await page.close();
}

await browser.close();

writeFileSync(OUT, JSON.stringify(snapshot, null, 1));

const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

const orphans = snapshot.filter((item) => item.lastLineWords === 1);

console.log(`origin ${ORIGIN}   ${snapshot.length} wrapping elements`);
console.log(`blocks ending on a single stranded word: ${orphans.length}\n`);
console.log(
  ["page", "w", "selector", "text", "ln", "ragged", "min", "max", "last", "text-wrap"]
    .map((h, i) => h.padEnd([8, 5, 34, 42, 3, 7, 7, 7, 5, 16][i]))
    .join(""),
);

for (const item of snapshot) {
  console.log(
    [
      item.page.padEnd(8),
      String(item.width).padEnd(5),
      clip(item.selector, 33).padEnd(34),
      clip(item.text, 41).padEnd(42),
      String(item.lines).padEnd(3),
      item.ragged.toFixed(2).padStart(6).padEnd(7),
      item.min.toFixed(1).padStart(6).padEnd(7),
      item.max.toFixed(1).padStart(6).padEnd(7),
      String(item.lastLineWords).padStart(3).padEnd(5),
      item.textWrap,
    ].join(""),
  );
}

console.log(`\nwrote ${OUT}`);
