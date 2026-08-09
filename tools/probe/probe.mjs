// Ad-hoc browser probe. Not a gate, not committed to the test run -- it is the
// "go and look" step for a bug report that disagrees with what the CSS says.
import { chromium } from "playwright-core";

const URL_UNDER_TEST = process.argv[2] ?? "http://127.0.0.1:3100/?country=us";
const WIDTH = Number(process.argv[3] ?? 1280);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: WIDTH, height: 900 } });

await page.goto(URL_UNDER_TEST, { waitUntil: "networkidle" });

const head = page.locator(".facets__head");
console.log("viewport", WIDTH);
console.log("head.innerText  :", JSON.stringify(await head.innerText()));
console.log("head.textContent:", JSON.stringify(await head.textContent()));

for (const sel of [".facets__heading", ".facets__toggle", ".facets__applied"]) {
  const el = page.locator(sel).first();
  const n = await el.count();
  console.log(
    sel,
    "count=" + n,
    n ? "display=" + (await el.evaluate((e) => getComputedStyle(e).display)) : "",
    n ? "text=" + JSON.stringify(await el.textContent()) : "",
  );
}

console.log("legends:", JSON.stringify(await page.locator(".facet__legend").allInnerTexts()));

await page.screenshot({ path: `/tmp/shot-${WIDTH}.png`, fullPage: false });
await browser.close();
