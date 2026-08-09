import { chromium } from "playwright-core";
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, args:["--no-sandbox"] });
for (const [label, url] of [["newest","/?country=us"],["nearest-country","/?country=us&sort=near"]]) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto("http://127.0.0.1:3103"+url, { waitUntil: "networkidle" });
  await page.locator(".listing__body").screenshot({ path: `/tmp/hero-${label}.png`, clip: undefined }).catch(()=>{});
  const box = await page.locator(".listing-hero").boundingBox();
  await page.screenshot({ path: `/tmp/hero-${label}.png`, clip: { x: box.x-10, y: box.y-10, width: box.width+20, height: 150 } });
  await page.close();
}
await browser.close();
