// Does the Ultra mask take the shape of the headline, and land on it?
//
// The brightness is not measurable here and never will be: headless Chromium has
// no HDR display and, on this VM, no WebGPU adapter -- so the canvas marks itself
// `data-ultra-fill="unsupported"`, ultra.css takes it out of the page, and the
// headline stays ordinary white. That path is a reading of its own, and it is
// the first thing below: the words must still be there, and still be inked.
//
// What CAN be measured is the half that is not about the GPU. The canvas is
// forced visible and painted flat red -- what the WebGPU pass puts there, minus
// the headroom -- and the mask is populated with the same <text> lines the
// component builds from the real layout. Then three screenshots of the h1:
//
//   ink      the words in white, no canvas          -- white pixels = the glyphs
//   masked   red through the mask, no ink           -- red pixels = the mask
//   over     red through the mask, over white ink   -- white left = glyphs missed
//
// A mask that is the right SHAPE has `masked` well under the whole box and well
// over zero. A mask that is in the right PLACE leaves almost no white in `over`:
// every glyph pixel is covered by the red that replaced it.
//
// Usage: node tools/probe/ultra.mjs [origin] [path]
import { chromium } from "playwright-core";

const ORIGIN = process.argv[2] ?? "http://127.0.0.1:3000";
const PATHS = process.argv[3] ? [process.argv[3]] : ["/", "/jobs/JR41734"];
const WIDTHS = [390, 1280];

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  args: ["--no-sandbox"],
});

function fallbackReading() {
  const canvas = document.querySelector(".ultra-fill");
  const ink = document.querySelector(".ultra__ink");

  return {
    fill: canvas.dataset.ultraFill ?? null,
    canvasDisplay: getComputedStyle(canvas).display,
    // No data-ultra means the headline never gave up its ink, which is the
    // whole of the no-WebGPU story.
    lit: document.querySelector("h1").dataset.ultra ?? null,
    inkColour: getComputedStyle(ink).color,
    text: ink.textContent,
    maskLines: document.querySelectorAll(".ultra__mask text").length,
  };
}

// Stand in for the WebGPU pass: same element, same mask, flat red.
function forceFill(mode) {
  const canvas = document.querySelector(".ultra-fill");
  const ink = document.querySelector(".ultra__ink");

  canvas.style.display = mode === "ink" ? "none" : "block";
  canvas.style.background = "rgb(255, 0, 0)";
  ink.style.color = mode === "masked" ? "transparent" : "#fff";
}

async function pixels(page) {
  const shot = await page.locator("h1").screenshot();

  return page.evaluate(
    (bytes) =>
      new Promise((resolve) => {
        const image = new Image();
        image.onload = () => {
          const surface = document.createElement("canvas");
          surface.width = image.width;
          surface.height = image.height;
          const context = surface.getContext("2d");
          context.drawImage(image, 0, 0);
          const { data } = context.getImageData(0, 0, image.width, image.height);
          let red = 0;
          let white = 0;
          for (let i = 0; i < data.length; i += 4) {
            const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
            if (r > 200 && g < 80 && b < 80) red += 1;
            if (r > 200 && g > 200 && b > 200) white += 1;
          }
          resolve({ red, white });
        };
        image.src = `data:image/png;base64,${bytes}`;
      }),
    shot.toString("base64"),
  );
}

async function reading(page, mode) {
  await page.evaluate(forceFill, mode);
  await page.waitForTimeout(120);

  return pixels(page);
}

for (const path of PATHS) {
  for (const width of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(ORIGIN + path, { waitUntil: "networkidle" });
    // The <text> lives in <defs>, so it is never "visible" -- wait on the count.
    await page.waitForFunction(
      () => document.querySelectorAll(".ultra__mask text").length > 0,
    );

    const fallback = await page.evaluate(fallbackReading);
    const ink = await reading(page, "ink");
    const masked = await reading(page, "masked");
    const over = await reading(page, "over");

    console.log(
      path,
      width,
      JSON.stringify({
        ...fallback,
        glyphPixels: ink.white,
        maskPixels: masked.red,
        glyphsMissedByMask: over.white,
        covered: +(1 - over.white / ink.white).toFixed(4),
      }),
    );
    await page.close();
  }
}

await browser.close();
