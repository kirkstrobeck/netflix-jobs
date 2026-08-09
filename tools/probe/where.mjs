// What GET /api/where does to the page it refines.
//
// Three claims, none of which a unit test can make: that the country arrives
// AFTER paint rather than delaying it, that nothing moves when it does, and
// that naming a place never re-applies the filter the visitor cleared.
//
// The geo header is set per request, which is the only way to stand in for
// Vercel's edge from in here.
//
// Usage: node tools/probe/where.mjs [origin]
import { chromium } from "playwright-core";

const ORIGIN = process.argv[2] ?? "http://127.0.0.1:3100";
// Country cleared, Nearest asked for: the state with no tier of its own.
const CLEARED = `${ORIGIN}/?country=all&sort=near`;

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  args: ["--no-sandbox"],
});

// What the page says and where it sits, at one instant.
const READ = () => {
  const title = document.querySelector(".listing-title");
  // Not `.result`: the prerendered shell streams a PAGE_SIZE run of
  // .result--ghost placeholders, and for a moment both are in the DOM. Reading
  // the first ghost as if it were the first row reports the skeleton swap as a
  // 77px jump caused by whatever else happened to be measured.
  const first = document.querySelector(".result:not(.result--ghost)");
  const offer = document.querySelector(".location-offer");

  return {
    heading: title?.textContent ?? null,
    // innerText, not textContent: at a narrow width the clause is display: none
    // and only one of the two reports that.
    shown: title?.innerText ?? null,
    where: document.querySelector(".listing-title__where")?.textContent ?? null,
    offer: offer?.textContent?.slice(0, 40) ?? null,
    resultsTop: first ? Math.round(first.getBoundingClientRect().top) : null,
    count: document.querySelectorAll(".result:not(.result--ghost)").length,
    ghosts: document.querySelectorAll(".result--ghost").length,
    url: location.href,
    ticked: [...document.querySelectorAll(".option__box:checked")].length,
  };
};

async function run(label, { geo, width = 1280 }) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    extraHTTPHeaders: geo ? { "x-vercel-ip-country": geo } : {},
  });

  // "Everywhere" is a choice, and the cookie is where the choice is kept -- a
  // bare URL with no country and no cookie gets the proxy's country hop instead
  // (see country-redirect.ts). Without this the probe never reaches the state
  // it exists to test.
  await context.addCookies([
    { name: "nfj_country", value: "all", domain: "127.0.0.1", path: "/" },
  ]);

  const page = await context.newPage();

  // The listing's own fetches are allowed through; /api/where is held so the
  // page can be read in the state it paints in, before the refinement lands.
  let release = () => {};
  const held = new Promise((resolve) => {
    release = resolve;
  });

  await page.route("**/api/where", async (route) => {
    await held;
    await route.continue();
  });

  // NOT networkidle: /api/where is deliberately held below, so the network
  // never goes idle until it is let go -- which is the whole point. Waiting on
  // the first row instead is waiting on the paint this refinement must not
  // delay.
  await page.goto(CLEARED, { waitUntil: "domcontentloaded" });
  // Settled means the streamed listing has replaced the prerendered skeleton
  // and hydration has run -- everything except the held refinement.
  await page.locator(".result:not(.result--ghost)").first().waitFor({ timeout: 15000 });
  await page.waitForFunction(() => !document.querySelector(".result--ghost"), null, { timeout: 15000 });
  await page.waitForTimeout(400);

  const painted = await page.evaluate(READ);

  release();
  // The refinement is one line of text, so there is nothing to wait FOR except
  // the change itself -- or, when the answer is null, for it not to come.
  await page
    .waitForFunction(() => document.querySelector(".listing-title__where"), null, {
      timeout: 3000,
    })
    .catch(() => null);
  await page.waitForTimeout(200);

  const refined = await page.evaluate(READ);

  console.log(`\n${label}  (${width}px, geo ${geo ?? "absent"})`);
  console.log(`  painted : "${painted.heading}"  results at y=${painted.resultsTop}, ${painted.count} rows`);
  console.log(`  refined : "${refined.heading}"  results at y=${refined.resultsTop}, ${refined.count} rows`);
  console.log(`  clause  : ${refined.where === null ? "none" : `"${refined.where}" (${refined.shown.toLowerCase().includes("you are in") ? "shown" : "in the DOM, not displayed"})`}`);
  console.log(`  offer   : "${refined.offer}"`);
  console.log(`  moved   : ${refined.resultsTop === painted.resultsTop ? "no" : `YES by ${refined.resultsTop - painted.resultsTop}px`}`);
  console.log(`  filter  : ${refined.url === painted.url ? "url unchanged" : `URL CHANGED to ${refined.url}`}, ${refined.ticked} boxes ticked`);

  await context.close();
}

await run("a visitor the edge placed", { geo: "US" });
await run("the same, on a phone", { geo: "US", width: 375 });
await run("a country with no roles", { geo: "KE" });
await run("no edge at all", { geo: null });

await browser.close();
