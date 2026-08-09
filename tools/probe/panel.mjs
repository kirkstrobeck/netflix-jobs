import { chromium } from "playwright-core";

const URL_UNDER_TEST =
  process.argv[2] ?? "http://127.0.0.1:3100/?country=us&type=onsite&q=manager";

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 1600 } });
await page.goto(URL_UNDER_TEST, { waitUntil: "networkidle" });

// Every painted box inside the panel, top to bottom, so the gaps between
// consecutive rows can be read off directly.
const rows = await page.evaluate(() => {
  const out = [];
  const walk = (el, depth) => {
    for (const child of el.children) {
      const r = child.getBoundingClientRect();
      const style = getComputedStyle(child);
      if (style.display === "none" || r.height === 0) continue;
      out.push({
        depth,
        tag: child.className || child.tagName,
        text: (child.textContent || "").trim().slice(0, 28),
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
      });
      if (depth < 2) walk(child, depth + 1);
    }
  };
  walk(document.querySelector(".facets__panel"), 0);
  return out;
});

let prev = null;
for (const r of rows) {
  const gap = prev ? r.top - prev.bottom : 0;
  console.log(
    `${String(gap).padStart(5)}  ${"  ".repeat(r.depth)}${r.tag.slice(0, 22).padEnd(24)} ${JSON.stringify(r.text)}`,
  );
  if (r.depth === 0 || r.depth === 1) prev = r;
}

await page.locator(".facets").screenshot({ path: "/tmp/panel.png" });
await browser.close();
