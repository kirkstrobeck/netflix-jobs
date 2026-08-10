// What the render-blocking stylesheets cost the first paint.
//
// Loads the page N times with a cold cache and reports first contentful paint,
// plus the bytes of every stylesheet the document blocks on. `--block=<substr>`
// aborts any request whose URL contains the substring, which is how the cost of
// one sheet is read off rather than argued about.
//
// Usage: node tools/probe/first-paint.mjs [url] [runs] [--block=substr] [--throttle]
import { chromium } from "playwright-core";

const URL_UNDER_TEST = process.argv[2] ?? "http://127.0.0.1:3000/?country=US";
const RUNS = Number(process.argv[3] ?? 7);
const BLOCK = (process.argv.find((a) => a.startsWith("--block=")) ?? "").slice(8);
const THROTTLE = process.argv.includes("--throttle");

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  args: ["--no-sandbox"],
});

const paints = [];
let sheets = [];

for (let run = 0; run < RUNS; run += 1) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const seen = [];

  if (BLOCK) {
    await page.route(`**/*${BLOCK}*`, (route) => route.abort());
  }

  // Localhost hides the whole point of a large stylesheet: 156KB arrives in two
  // milliseconds here and 787KB in nine, so an unthrottled reading measures
  // parsing and nothing else. --throttle puts a slow 4G pipe in front of it,
  // which is where a render-blocking sheet is actually paid for.
  if (THROTTLE) {
    const cdp = await context.newCDPSession(page);

    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    });
  }

  page.on("response", async (response) => {
    const type = response.headers()["content-type"] ?? "";

    if (!type.includes("text/css")) {
      return;
    }

    const body = await response.body().catch(() => null);
    seen.push({
      url: response.url().split("/").pop(),
      bytes: body ? body.length : 0,
      encoding: response.headers()["content-encoding"] ?? "identity",
    });
  });

  await page.goto(URL_UNDER_TEST, { waitUntil: "load" });
  // The paint timings are only complete once the entries have been buffered.
  const fcp = await page.evaluate(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

    const entry = performance
      .getEntriesByType("paint")
      .find((e) => e.name === "first-contentful-paint");

    return entry ? entry.startTime : null;
  });

  paints.push(fcp);
  sheets = seen;
  await context.close();
}

const ok = paints.filter((p) => typeof p === "number").sort((a, b) => a - b);
const median = ok[Math.floor(ok.length / 2)];

const how = `${BLOCK ? `  (blocking *${BLOCK}*)` : ""}${THROTTLE ? "  (slow 4G)" : ""}`;

console.log(`${URL_UNDER_TEST}${how}`);
console.log("  stylesheets the document blocks on:");

for (const sheet of sheets.sort((a, b) => b.bytes - a.bytes)) {
  console.log(
    `    ${String(sheet.bytes).padStart(8)} B  ${sheet.encoding.padEnd(9)} ${sheet.url}`,
  );
}

console.log(`    ${String(sheets.reduce((n, s) => n + s.bytes, 0)).padStart(8)} B  total`);
console.log(
  `  FCP over ${RUNS} cold loads: median ${median?.toFixed(1)}ms  ` +
    `min ${ok[0]?.toFixed(1)}ms  max ${ok[ok.length - 1]?.toFixed(1)}ms`,
);
console.log(`  raw: ${ok.map((p) => p.toFixed(1)).join(", ")}`);

await browser.close();
