// Does the wordmark still point at the board the visitor is looking at, after
// the panel has filtered without a round trip?
//
// The bug this answers: both marks sit in the @header/@footer slots, which do
// not re-render for a pushState, so a server-rendered href is correct exactly
// once. Asserting it in jsdom is not enough -- the question is whether a real
// click lands where the attribute says, and next/link decides that from its
// prop rather than from the DOM. So this ticks a real box in a real browser,
// reads the live attributes, and then clicks.
import { chromium } from "playwright-core";

const ORIGIN = process.argv[2] ?? "http://127.0.0.1:3000";
const START = `${ORIGIN}/?country=US&team=Marketing`;

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const HEADER = ".site-header .wordmark";
const FOOTER = ".job-footer__wordmark";

// The attribute as the DOM holds it right now, not as it was served.
const marks = () =>
  page.evaluate(
    ([header, footer]) => ({
      header: document.querySelector(header)?.getAttribute("href"),
      footer: document.querySelector(footer)?.getAttribute("href"),
      url: location.pathname + location.search,
    }),
    [HEADER, FOOTER],
  );

const report = async (label) => {
  const seen = await marks();
  const agree = seen.header === seen.url && seen.footer === seen.url;

  console.log(`\n${label}`);
  console.log(`  url    : ${seen.url}`);
  console.log(`  header : ${seen.header}`);
  console.log(`  footer : ${seen.footer}`);
  console.log(`  ${agree ? "OK   both marks == url" : "STALE mark != url"}`);

  return seen;
};

await page.goto(START, { waitUntil: "networkidle" });
await report("1. filtered board, as served");

// Tick another facet: the first work-type box that is not already on.
const box = page.locator("li:not(:has(.option--on)) .option__box").first();
const ticked = await box.evaluate((el) => el.closest("label")?.innerText.trim());
await box.click();
await page.waitForFunction(
  (from) => location.pathname + location.search !== from,
  START.slice(ORIGIN.length),
);
console.log(`\n   ticked: ${JSON.stringify(ticked)}`);
const after = await report("2. after a client-side facet tick");

// And now the part an attribute cannot answer: next/link navigates to the href
// it was RENDERED with, not the one in the DOM, so where a click lands is a
// separate question from what the attribute says.
//
// A soft navigation fires no load event, so networkidle can return before the
// router has moved. Settle on the URL itself instead -- poll until it has held
// still -- or a stale destination is read as the current one and the whole
// assertion passes by accident.
const settled = async () => {
  let last = null;

  for (let still = 0; still < 4; still += 1) {
    await page.waitForTimeout(250);
    const now = page.url();

    still = now === last ? still : 0;
    last = now;
  }

  return last.slice(ORIGIN.length);
};

await page.click(HEADER);
const landed = await settled();
console.log(`\n3. clicked the header mark`);
console.log(`  landed : ${landed}`);
console.log(`  ${landed === after.url ? "OK   same board" : `WRONG board, wanted ${after.url}`}`);
await report("   marks after landing");

// Untick everything: back to a bare board, and both marks back to "/".
await page.goto(START, { waitUntil: "networkidle" });
for (let n = await page.locator(".option--on .option__box").count(); n > 0; n -= 1) {
  await page.locator(".option--on .option__box").first().click();
  await page.waitForTimeout(150);
}
const bare = await report("4. every facet unticked");
console.log(`  ${bare.header === "/" && bare.footer === "/" ? "OK   both are /" : "NOT /"}`);

await browser.close();
