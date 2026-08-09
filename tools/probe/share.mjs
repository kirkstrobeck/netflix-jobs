// The share control's fallback chain, driven in a real engine.
//
// Every rung of it is a branch that cannot be reached by unit test, because
// what decides the branch is the browser: whether navigator.share exists at
// all, whether the sheet resolves or rejects, and which name it rejects with.
// Each case below stubs exactly one of those and reports what the control did.
//
// Usage: node tools/probe/share.mjs [url]
import { chromium } from "playwright-core";

const URL_UNDER_TEST = process.argv[2] ?? "http://127.0.0.1:3100/jobs/JR42023";

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  args: ["--no-sandbox"],
});

// Each case replaces navigator.share / navigator.clipboard before any script on
// the page runs, so the control sees the browser it is being asked about.
const CASES = [
  {
    name: "no share, no clipboard",
    setup: `delete Navigator.prototype.share;
            Object.defineProperty(navigator, "clipboard", { value: undefined });`,
    expect: "follows the href",
  },
  {
    name: "no share, clipboard",
    setup: `delete Navigator.prototype.share;
            Object.defineProperty(navigator, "clipboard", {
              value: { writeText: (t) => { window.__copied = t; return Promise.resolve(); } },
            });`,
    expect: "copies and confirms",
  },
  {
    name: "share resolves",
    setup: `Object.defineProperty(navigator, "share", {
              configurable: true,
              value: (data) => { window.__shared = data; return Promise.resolve(); },
            });`,
    expect: "sheet only, no note",
  },
  {
    name: "share aborted",
    setup: `Object.defineProperty(navigator, "share", {
              configurable: true,
              value: (data) => { window.__shared = data; return Promise.reject(Object.assign(new Error("cancelled"), { name: "AbortError" })); },
            });
            Object.defineProperty(navigator, "clipboard", {
              value: { writeText: (t) => { window.__copied = t; return Promise.resolve(); } },
            });`,
    expect: "nothing at all",
  },
  {
    name: "share fails for real",
    setup: `Object.defineProperty(navigator, "share", {
              configurable: true,
              value: (data) => { window.__shared = data; return Promise.reject(new TypeError("not allowed here")); },
            });
            Object.defineProperty(navigator, "clipboard", {
              value: { writeText: (t) => { window.__copied = t; return Promise.resolve(); } },
            });`,
    expect: "falls through to the clipboard",
  },
];

for (const testCase of CASES) {
  // A context per case rather than a page: the last rung of the chain is the
  // anchor's own navigation, and target="_blank" makes that a NEW page instead
  // of a change of url on this one. Watching the context is the only way to see
  // it happen.
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  const opened = [];

  context.on("page", (child) => opened.push(child));

  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });

  await page.addInitScript(testCase.setup);
  await page.goto(URL_UNDER_TEST, { waitUntil: "networkidle" });

  const before = page.url();

  await Promise.all([
    // The popup's url is not settled the instant the page object appears, so
    // the wait is on the event rather than on a sleep -- and only in the case
    // that expects one, since a 2s timeout would otherwise run the confirmation
    // note's whole life out before it could be looked at.
    testCase.expect.includes("href")
      ? context.waitForEvent("page", { timeout: 2000 }).catch(() => null)
      : Promise.resolve(),
    page.locator(".share-button").click(),
  ]);
  await page.waitForTimeout(250);

  const note = await page.locator(".share-note").evaluate((el) => ({
    text: el.textContent,
    visibility: getComputedStyle(el).visibility,
    opacity: getComputedStyle(el).opacity,
  }));

  const state = await page.evaluate(() => ({
    shared: window.__shared ?? null,
    copied: window.__copied ?? null,
  }));

  const followed = opened.length > 0 ? opened[0].url() : null;

  console.log(`\n${testCase.name}  -- expected: ${testCase.expect}`);
  console.log(
    `  navigated : ${followed ?? (page.url() !== before ? page.url() : "no")}`,
  );
  console.log(`  share()   : ${state.shared ? JSON.stringify(state.shared) : "not called"}`);
  console.log(`  clipboard : ${state.copied ?? "not written"}`);
  console.log(`  note      : ${note.visibility}, opacity ${note.opacity}, "${note.text}"`);
  console.log(`  errors    : ${errors.length ? errors.join(" | ") : "none"}`);

  // And that it takes itself away again, fading rather than vanishing.
  if (note.visibility === "visible") {
    await page.waitForTimeout(2450);
    const mid = await page.locator(".share-note").evaluate((el) => ({
      opacity: getComputedStyle(el).opacity,
      visibility: getComputedStyle(el).visibility,
    }));

    await page.waitForTimeout(400);

    const after = await page.locator(".share-note").evaluate((el) => ({
      opacity: getComputedStyle(el).opacity,
      visibility: getComputedStyle(el).visibility,
    }));

    console.log(`  fading    : ${mid.visibility} ${mid.opacity} -> ${after.visibility} ${after.opacity}`);
  }

  await context.close();
}

await browser.close();
