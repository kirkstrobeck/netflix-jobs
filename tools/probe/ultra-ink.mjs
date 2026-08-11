// Is the headline WORD there, in the first frame the visitor gets?
//
// The Ultra pass takes the real text's ink away the moment `data-ultra="on"`
// lands, and the fill that replaces it is a WebGPU canvas. Between those two
// events -- and on any frame where the surface has not presented -- there is
// nothing in the box at all. A white floor under the canvas, the same masked
// rectangle painted in plain white, is what makes that gap invisible: the word
// is always painted, and the canvas either covers it with a brighter one or
// does not.
//
// Ink is counted as near-white pixels inside the h1's own box, NOT as pixels
// unlike the background: the listing headline sits over the bars backdrop, so
// "unlike the background" counts nine-tenths of the box and reports the bars.
// The word is the only white thing in there.
//
// Every reading is taken twice, at first paint and again two seconds later,
// because the defect is a DIFFERENCE between the two.
//
//   --no-webgpu   launch with the adapter unavailable, which is the fallback
//                 path: no canvas, ordinary white text, both counts equal.
//   --flash       the recorded frame itself: data-ultra="on", so the real text
//                 is transparent, with a canvas that is painting nothing. This
//                 is the state the defect is about.
//   --force-fill  a WebGPU surface that IS presenting, stood in for by turning
//                 the canvas on and painting it flat white -- the only way to
//                 read the lit path on a VM with no adapter.
//
// Usage: node tools/probe/ultra-ink.mjs [url] [--no-webgpu] [--flash|--force-fill]
import { chromium } from "playwright-core";

const URL_UNDER_TEST = process.argv[2] ?? "http://127.0.0.1:3100/?country=US";
const NO_WEBGPU = process.argv.includes("--no-webgpu");
const FLASH = process.argv.includes("--flash");
const FORCE_FILL = process.argv.includes("--force-fill");
const SETTLE_MS = 2000;

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  // Chromium has no adapter on this VM to begin with, so --no-webgpu is belt and
  // braces: it makes the fallback path deterministic rather than incidental.
  args: NO_WEBGPU
    ? ["--no-sandbox", "--disable-features=WebGPU", "--disable-gpu"]
    : ["--no-sandbox"],
});

function countInk(bytes) {
  return new Promise((resolve) => {
    const image = new Image();

    image.onload = () => {
      const surface = document.createElement("canvas");
      surface.width = image.width;
      surface.height = image.height;

      const context = surface.getContext("2d", { willReadFrequently: true });
      context.drawImage(image, 0, 0);

      const { data } = context.getImageData(0, 0, image.width, image.height);
      let ink = 0;

      for (let i = 0; i < data.length; i += 4) {
        const white = data[i] > 200 && data[i + 1] > 200 && data[i + 2] > 200;
        ink += Number(white);
      }

      resolve({ ink, pixels: data.length / 4 });
    };

    image.src = `data:image/png;base64,${bytes}`;
  });
}

async function reading(page) {
  const shot = await page.locator("h1").screenshot();

  return page.evaluate((bytes) => countInk(bytes), shot.toString("base64"));
}

// The recorded frame: the headline has given up its ink and the canvas over it
// is painting nothing. No stylesheet can be asked for this state -- it is a
// timing window -- so it is set by hand.
function flash() {
  document.querySelector("h1.ultra").dataset.ultra = "on";
}

// A presenting WebGPU surface: the same element, the same mask, a flat white
// fill, and data-ultra="on" so the real text gives up its ink exactly as it does
// when the GPU answers.
function lightIt() {
  const canvas = document.querySelector(".ultra-fill");

  canvas.removeAttribute("data-ultra-fill");
  canvas.style.display = "block";
  canvas.style.background = "#fff";
  document.querySelector("h1.ultra").dataset.ultra = "on";
}

const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.addInitScript(`window.countInk = ${countInk.toString()}`);
await page.goto(URL_UNDER_TEST, { waitUntil: "domcontentloaded" });
await page.waitForSelector("h1");

const first = await reading(page);

await page.waitForTimeout(SETTLE_MS);

if (FLASH) {
  await page.evaluate(flash);
  await page.waitForTimeout(200);
}

if (FORCE_FILL) {
  await page.evaluate(lightIt);
  await page.waitForTimeout(200);
}

const settled = await reading(page);

const state = await page.evaluate(() => ({
  lit: document.querySelector("h1.ultra")?.dataset.ultra ?? null,
  fill: document.querySelector(".ultra-fill")?.dataset.ultraFill ?? null,
  inkColour: getComputedStyle(document.querySelector(".ultra__ink")).color,
  backdrop: document.querySelector(".ultra__backdrop") ? "present" : "absent",
}));

const modes = [NO_WEBGPU && "--no-webgpu", FLASH && "--flash", FORCE_FILL && "--force-fill"];
const how = modes.filter(Boolean).join(" ");

console.log(`${URL_UNDER_TEST}  ${how}`);
console.log(`  state              ${JSON.stringify(state)}`);
console.log(`  h1 box             ${first.pixels}px`);
console.log(`  ink at first paint ${first.ink}`);
console.log(`  ink after ${SETTLE_MS}ms   ${settled.ink}`);

await browser.close();
