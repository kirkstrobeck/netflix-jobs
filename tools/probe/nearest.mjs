// Items 3, 4 and 5, driven in a real browser: what the heading says at each
// precision tier, and what the offer does after a denial.
import { chromium } from "playwright-core";

const ORIGIN = process.argv[2] ?? "http://127.0.0.1:3101";
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  args: ["--no-sandbox"],
});

const read = async (page) => ({
  heading: (await page.locator("h2#open-roles").innerText()).trim(),
  headingId: await page.locator("h2#open-roles").getAttribute("id"),
  offer: (await page.locator(".location-offer").count())
    ? (await page.locator(".location-offer").innerText()).trim()
    : null,
  button: await page.locator(".location-offer__action").count(),
  firstRole: await page.locator(".result__title").first().innerText(),
});

const show = (label, state) => {
  console.log(`\n--- ${label}`);
  console.log(`  heading : ${JSON.stringify(state.heading)}  (id=${state.headingId})`);
  console.log(`  offer   : ${JSON.stringify(state.offer)}`);
  console.log(`  button  : ${state.button}`);
  console.log(`  first   : ${JSON.stringify(state.firstRole)}`);
};

async function tier(label, url, prepare) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${ORIGIN}${url}`, { waitUntil: "networkidle" });
  if (prepare) await prepare(context, page);
  await page.waitForTimeout(700);
  show(label, await read(page));
  await context.close();
}

const deny = (context, page) =>
  context
    .newCDPSession(page)
    .then((cdp) =>
      cdp.send("Browser.setPermission", {
        origin: ORIGIN,
        permission: { name: "geolocation" },
        setting: "denied",
      }),
    );

// 1. Newest: the heading states the order.
await tier("newest, no location at all", "/?country=us");

// 2. Country tier: ?sort=near with no device position. This is the case that
//    used to print "Location is blocked for this site, so roles are ordered
//    newest first."
await tier("nearest, country tier only", "/?country=us&sort=near");

// 3. Denied, then press the offer: the dead-end path.
await tier("nearest, permission denied", "/?country=us&sort=near", async (context, page) => {
  await deny(context, page);
  await page.locator(".location-offer__action").click().catch(() => {});
  await page.waitForTimeout(600);
});

// 4. Device tier, coarse fix (42km radius -- wider than half a 50km ring).
await tier("nearest, device tier, coarse fix", "/?country=us&sort=near", async (context, page) => {
  await context.grantPermissions(["geolocation"], { origin: ORIGIN });
  await context.setGeolocation({ latitude: 37.23, longitude: -121.96, accuracy: 42000 });
  await page.reload({ waitUntil: "networkidle" });
});

// 5. Device tier, precise fix.
await tier("nearest, device tier, precise fix", "/?country=us&sort=near", async (context, page) => {
  await context.grantPermissions(["geolocation"], { origin: ORIGIN });
  await context.setGeolocation({ latitude: 37.23, longitude: -121.96, accuracy: 25 });
  await page.reload({ waitUntil: "networkidle" });
});

await browser.close();
