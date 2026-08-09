// Measure the sidebar's vertical rhythm: the real painted gap above each group
// heading versus the gap below it. Item 2 is a claim about numbers, so the
// numbers get read off the page rather than off the stylesheet.
import { chromium } from "playwright-core";

const URL_UNDER_TEST =
  process.argv[2] ?? "http://127.0.0.1:3100/?country=us&type=onsite&team=Marketing";

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(URL_UNDER_TEST, { waitUntil: "networkidle" });

const rows = await page.evaluate(() => {
  const box = (el) => el.getBoundingClientRect();
  const out = [];
  const groups = [...document.querySelectorAll(".facets__panel > .facet")];

  groups.forEach((group, i) => {
    const legend = group.querySelector(".facet__legend");
    const firstAfter = legend?.nextElementSibling?.nextElementSibling ?? null;
    const prev = i === 0 ? null : groups[i - 1];
    out.push({
      name: legend?.textContent?.trim().slice(0, 24) ?? "?",
      above: prev ? Math.round(box(legend).top - box(prev).bottom) : null,
      below: firstAfter ? Math.round(box(firstAfter).top - box(legend).bottom) : null,
    });
  });
  return out;
});

console.log("group".padEnd(26), "above".padStart(6), "below".padStart(6), "  verdict");
for (const r of rows) {
  const ok = r.above === null || r.above > (r.below ?? 0) * 1.5;
  console.log(
    r.name.padEnd(26),
    String(r.above).padStart(6),
    String(r.below).padStart(6),
    "  " + (ok ? "ok" : "BACKWARDS"),
  );
}

await browser.close();
