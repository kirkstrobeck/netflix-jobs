// What the LABEL of a control actually paints as, pixel by pixel, per state.
//
// cta.mjs answers "does the control have an edge against the backdrop". This
// answers the other half: is the text ON the control legible, measured off the
// painted glyphs rather than off the declared colour pair -- and in every state
// the control can be in, because a hover fill is a different colour pair.
import { chromium } from "playwright-core";

import { contrast, hex, luminance } from "./contrast.mjs";

const URL_UNDER_TEST = process.argv[2];
const SELECTORS = (process.argv[3] ?? ".apply-button,.share-button").split(",");
const STATES = (process.argv[4] ?? "rest,hover").split(",");

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.goto(URL_UNDER_TEST, { waitUntil: "networkidle" });

const reader = await browser.newPage();

async function pixels(clip) {
  const shot = await page.screenshot({ clip });

  return reader.evaluate(async (data) => {
    const bitmap = await createImageBitmap(
      await (await fetch(`data:image/png;base64,${data}`)).blob(),
    );
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d");

    context.drawImage(bitmap, 0, 0);

    const { data: rgba } = context.getImageData(0, 0, bitmap.width, bitmap.height);

    return { width: bitmap.width, height: bitmap.height, rgba: Array.from(rgba) };
  }, shot.toString("base64"));
}

async function read(selector, state) {
  const handle = page.locator(selector).first();

  await handle.scrollIntoViewIfNeeded();

  if (state === "hover") {
    await handle.hover();
  }

  if (state === "rest") {
    await page.mouse.move(5, 5);
  }

  const box = await handle.boundingBox();
  const meta = await handle.evaluate((el) => {
    const cs = getComputedStyle(el);

    return {
      size: cs.fontSize,
      weight: cs.fontWeight,
      ink: cs.color,
      fill: cs.backgroundColor,
    };
  });
  // Inside the padding box, so nothing but fill and glyph is in the sample.
  const frame = await pixels({
    x: Math.round(box.x + 20),
    y: Math.round(box.y + 8),
    width: Math.round(box.width - 40),
    height: Math.round(box.height - 16),
  });
  const px = [];

  for (let i = 0; i < frame.rgba.length; i += 4) {
    px.push([frame.rgba[i], frame.rgba[i + 1], frame.rgba[i + 2]]);
  }

  const fill = px.reduce((a, b) => (luminance(b) < luminance(a) ? b : a));
  const lit = px.filter((p) => luminance(p) > luminance(fill) * 1.5 + 0.02);
  const peak = lit.reduce((a, b) => (luminance(b) > luminance(a) ? b : a));
  // "Large text" under WCAG: >=18.66px bold, or >=24px. Sets the threshold.
  const size = Number.parseFloat(meta.size);
  const large = size >= 24 || (size >= 18.66 && Number(meta.weight) >= 700);
  const need = large ? 3 : 4.5;
  const ratio = contrast(peak, fill);

  console.log(
    `  ${state.padEnd(6)} ${meta.size.padEnd(7)}/${meta.weight}  label ${hex(
      peak,
    ).padEnd(18)} on fill ${hex(fill).padEnd(18)} ${ratio
      .toFixed(2)
      .padStart(5)}:1  need ${need}:1 (${large ? "large" : "normal"})  ${
      ratio >= need ? "PASS" : "FAIL"
    }`,
  );
}

for (const selector of SELECTORS) {
  console.log(selector);

  for (const state of STATES) {
    await read(selector, state);
  }
}

await browser.close();
