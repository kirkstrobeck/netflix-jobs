// Reading actual pixels out of a live page, and the three readings every
// contrast probe wants from a control's neighbourhood.
//
// Kept apart from the probes that use it because this is optics, not a claim.
// Nothing here knows what a good ratio is or which control is under test -- it
// turns a clip rectangle into numbers, and the probe decides what they mean.
// contrast.mjs is the next file along the same seam: it scores the numbers.

// A second page is the PNG decoder: nothing in node reads pixels, and Chromium
// already has a canvas.
export async function pixelReader(browser, page) {
  const reader = await browser.newPage();

  return async function pixels(clip) {
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
  };
}

// Three readings per frame: the band of backdrop just outside the control, the
// control's own surface, and its boundary.
//
// The boundary is returned as every pixel in the band straddling the box's
// edge rather than a single coordinate, for the caller to reduce. A control's
// box lands on a fractional y (450.6 in the hero), so one nominated pixel is a
// coin toss between the rim, its antialiasing and the fill behind it. On a
// control with no rim at all the band reads the fill, which is the right answer
// for that case too.
//
// `geometry` is where the probe's state lives: how far out the backdrop ring
// starts and how wide it is, and which rows count as the boundary. A focus
// outline reaches further out than a border, so those numbers are the caller's
// to choose, not this file's.
export function sample(frame, box, clip, geometry) {
  const { ringInset, ringWidth, edgeBand } = geometry;
  const at = (x, y) => {
    const i = (Math.round(y - clip.y) * frame.width + Math.round(x - clip.x)) * 4;

    return [frame.rgba[i], frame.rgba[i + 1], frame.rgba[i + 2]];
  };

  const ring = [];

  for (let d = ringInset; d < ringInset + ringWidth; d += 1) {
    for (let x = box.x - d; x <= box.x + box.width + d; x += 1) {
      ring.push(at(x, box.y - d), at(x, box.y + box.height + d));
    }

    for (let y = box.y - d; y <= box.y + box.height + d; y += 1) {
      ring.push(at(box.x - d, y), at(box.x + box.width + d, y));
    }
  }

  const edge = [];

  for (let x = box.x + 8; x <= box.x + box.width - 8; x += 1) {
    for (let d = edgeBand[0]; d <= edgeBand[1]; d += 1) {
      edge.push(at(x, box.y - d), at(x, box.y + box.height + d));
    }
  }

  return {
    ring,
    edge,
    // Inside the control's inline padding, so the sample is its surface rather
    // than a letter of its label.
    fill: at(box.x + 8, box.y + box.height / 2),
  };
}

// The clip a probe needs to see a control plus the whole band around it.
export function ringClip(box, geometry) {
  const pad = geometry.ringInset + geometry.ringWidth + 2;

  return {
    x: Math.max(0, box.x - pad),
    y: Math.max(0, box.y - pad),
    width: box.width + pad * 2,
    height: box.height + pad * 2,
  };
}
