// Does a denied geolocation permission stay denied, and can script re-prompt?
// Item 5 rests entirely on the answer, so it is measured rather than assumed.
import { chromium } from "playwright-core";

const ORIGIN = "http://127.0.0.1:3100";

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  args: ["--no-sandbox"],
});
const context = await browser.newContext();
const page = await context.newPage();
await page.goto(`${ORIGIN}/?country=us`, { waitUntil: "domcontentloaded" });

const cdp = await context.newCDPSession(page);
const setPermission = (setting) =>
  cdp.send("Browser.setPermission", {
    origin: ORIGIN,
    permission: { name: "geolocation" },
    setting,
  });

const ask = () =>
  page.evaluate(
    () =>
      new Promise((resolve) => {
        const t0 = performance.now();
        navigator.geolocation.getCurrentPosition(
          (p) =>
            resolve({
              ok: true,
              ms: Math.round(performance.now() - t0),
              accuracy: p.coords.accuracy,
            }),
          (e) => resolve({ ok: false, code: e.code, ms: Math.round(performance.now() - t0) }),
          { timeout: 10000, enableHighAccuracy: false },
        );
      }),
  );

const state = () =>
  page.evaluate(() =>
    navigator.permissions.query({ name: "geolocation" }).then((s) => s.state),
  );

// Watch for a permission change WITHOUT a reload -- the mechanism the retry
// path depends on.
await page.evaluate(() => {
  globalThis.__changes = [];
  navigator.permissions.query({ name: "geolocation" }).then((s) => {
    s.addEventListener("change", () => globalThis.__changes.push(s.state));
  });
});

await setPermission("denied");
await page.waitForTimeout(400);
console.log("after deny  : state =", await state());
console.log("  call 1    :", JSON.stringify(await ask()));
console.log("  call 2    :", JSON.stringify(await ask()));
console.log("  call 3    :", JSON.stringify(await ask()));

await context.grantPermissions(["geolocation"], { origin: ORIGIN });
await context.setGeolocation({ latitude: 45.487, longitude: -122.804, accuracy: 42000 });
await page.waitForTimeout(400);
console.log("after grant : state =", await state());
console.log("  call      :", JSON.stringify(await ask()));
console.log("change events observed (no reload):", await page.evaluate(() => globalThis.__changes));

await browser.close();
