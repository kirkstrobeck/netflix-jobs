// What the call-to-action pair is actually sitting on, frame by frame.
//
// The hero's backdrop is 15 translucent red bars that walk sideways on loops of
// up to ~254 seconds, so "take a screenshot and read the contrast" answers for
// one frame out of thousands. This drives the animations to chosen times with
// Animation.currentTime instead of waiting, samples the pixels immediately
// outside each control, and reports the WORST frame as well as the best.
//
// Usage: node tools/probe/cta.mjs [url] [selector,...] [samples] [rest|hover|focus]
import { chromium } from "playwright-core";

import { brightest, contrast, hex } from "./contrast.mjs";

const URL_UNDER_TEST = process.argv[2] ?? "http://127.0.0.1:3100/jobs/JR42023";
const SELECTORS = (process.argv[3] ?? ".apply-button").split(",");
const SAMPLES = Number(process.argv[4] ?? 160);
const STATE = process.argv[5] ?? "rest";
// Narrow the viewport to put a control on a line of its own: the backdrop band
// is otherwise polluted by whatever sits 12px away, and a neighbouring
// control's rim is not the backdrop.
const WIDTH = Number(process.argv[6] ?? 1280);
// The longest loop in the field, from app/_bars/bars-tunables.ts.
const LOOP_MS = 253_850;
// How far outside the control's own box the backdrop is sampled. 1px would land
// on the border's own antialiasing. Under focus the ring has to start beyond
// the focus outline -- 2px at a 3px offset -- or the "backdrop" reading is the
// indicator itself.
const RING_INSET = STATE === "focus" ? 8 : 2;
const RING_WIDTH = 5;
// Where the boundary is: the border row at rest, the outline under focus.
const EDGE_BAND = STATE === "focus" ? [3, 6] : [-1, 1];

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: WIDTH, height: 900 } });

await page.goto(URL_UNDER_TEST, { waitUntil: "networkidle" });

// PROBE_HIDE=.share-button takes a neighbour out of the frame, so the band
// around the control under test is backdrop and nothing else. Only needed for
// the focus outline, which reaches far enough out to meet the next control.
if (process.env.PROBE_HIDE) {
  await page.addStyleTag({
    content: `${process.env.PROBE_HIDE} { display: none !important; }`,
  });
}

// A second page is the PNG decoder: nothing in node reads pixels, and Chromium
// already has a canvas.
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

// Three readings per frame: the band of backdrop just outside the control, the
// control's own surface, and its boundary.
//
// The boundary is taken as the BRIGHTEST pixel in the 3px straddling the box's
// top edge rather than a single coordinate. A control's box lands on a
// fractional y (450.6 here), so one nominated pixel is a coin toss between the
// rim, its antialiasing and the fill behind it. On a control with no rim at all
// this reads the fill, which is the right answer for that case too.
function sample(frame, box, clip) {
  const at = (x, y) => {
    const i =
      (Math.round(y - clip.y) * frame.width + Math.round(x - clip.x)) * 4;

    return [frame.rgba[i], frame.rgba[i + 1], frame.rgba[i + 2]];
  };


  const ring = [];

  for (let d = RING_INSET; d < RING_INSET + RING_WIDTH; d += 1) {
    for (let x = box.x - d; x <= box.x + box.width + d; x += 1) {
      ring.push(at(x, box.y - d), at(x, box.y + box.height + d));
    }

    for (let y = box.y - d; y <= box.y + box.height + d; y += 1) {
      ring.push(at(box.x - d, y), at(box.x + box.width + d, y));
    }
  }

  const edge = [];

  for (let x = box.x + 8; x <= box.x + box.width - 8; x += 1) {
    for (let d = EDGE_BAND[0]; d <= EDGE_BAND[1]; d += 1) {
      edge.push(at(x, box.y - d), at(x, box.y + box.height + d));
    }
  }

  return {
    ring,
    // Inside the control's inline padding, so the sample is its surface rather
    // than a letter of its label.
    fill: at(box.x + 8, box.y + box.height / 2),
    edge: brightest(edge),
  };
}

for (const selector of SELECTORS) {
  const handle = page.locator(selector).first();

  if ((await handle.count()) === 0) {
    console.log(`${selector}: not on the page`);
    continue;
  }

  await handle.scrollIntoViewIfNeeded();

  // Chromium grants :focus-visible to a scripted focus() when the most recent
  // interaction was a keypress, which is a great deal faster than tabbing the
  // whole document -- and lands on the same state.
  if (STATE === "focus") {
    await page.keyboard.press("Tab");
    await handle.evaluate((el) => el.focus());
    console.log(
      "  focus-visible:",
      await handle.evaluate((el) => el.matches(":focus-visible")),
    );
  }

  if (STATE === "hover") {
    await handle.hover();
  }

  const box = await handle.boundingBox();
  const pad = RING_INSET + RING_WIDTH + 2;
  const clip = {
    x: Math.max(0, box.x - pad),
    y: Math.max(0, box.y - pad),
    width: box.width + pad * 2,
    height: box.height + pad * 2,
  };

  let worst = null;
  let best = null;

  for (let i = 0; i < SAMPLES; i += 1) {
    const time = (LOOP_MS / SAMPLES) * i;

    await page.evaluate((t) => {
      document.getAnimations().forEach((animation) => {
        // The root's gutter animation is scroll-driven, and a progress-based
        // timeline rejects an absolute currentTime. It is also not part of the
        // hero, so skipping it costs nothing.
        if (!(animation.timeline instanceof DocumentTimeline)) {
          return;
        }

        animation.pause();
        animation.currentTime = t;
      });
    }, time);

    const frame = await pixels(clip);
    const { ring, fill, edge } = sample(frame, box, clip);
    // The brightest pixel in the band is the one the edge has to survive, so the
    // frame is scored on its brightest backdrop rather than its average.
    const backdrop = brightest(ring);
    const record = {
      time: Math.round(time / 1000),
      backdrop,
      fill,
      edge,
      fillRatio: contrast(fill, backdrop),
      edgeRatio: contrast(edge, backdrop),
    };

    if (!worst || record.edgeRatio < worst.edgeRatio) {
      worst = record;
    }

    if (!best || record.edgeRatio > best.edgeRatio) {
      best = record;
    }
  }

  const report = (label, r) =>
    console.log(
      `  ${label.padEnd(8)} t=${String(r.time).padStart(3)}s  backdrop ${hex(
        r.backdrop,
      ).padEnd(16)} fill ${hex(r.fill).padEnd(16)} edge ${hex(r.edge).padEnd(
        16,
      )}  edge/backdrop ${r.edgeRatio.toFixed(2)}:1  fill/backdrop ${r.fillRatio.toFixed(2)}:1`,
    );

  console.log(`${selector}  (${SAMPLES} frames across ${LOOP_MS / 1000}s)`);
  report("dimmest", best);
  report("brightest", worst);
}

await browser.close();
