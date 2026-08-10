import { afterEach, describe, expect, it, vi } from "vitest";

import { glyphLines } from "@/lib/ultra/glyph-lines";

/**
 * jsdom has no layout and no 2D canvas, so both of the things this reads --
 * character rects and font metrics -- are stubbed. That is not a weaker test
 * than it looks: the arithmetic between them IS the module, and it is the part
 * that decides whether the mask lands on the glyphs or a few pixels off them.
 *
 * The real reading is tools/probe/ultra.mjs, which paints the mask over the
 * words in Chromium and counts the glyph pixels it misses. Measured 0 missed at
 * 390 and 1280, on the board's headline and on a three-line job title.
 */

// 20px ascent, 4px descent: a 24px content area inside whatever line box the
// rects below claim, so half-leading is visible in the answer.
const FONT_METRICS = { fontBoundingBoxAscent: 20, fontBoundingBoxDescent: 4 };

function stubFont(): void {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    font: "",
    measureText: () => FONT_METRICS,
  } as unknown as CanvasRenderingContext2D);
}

// One rect per character, in the order glyphLines asks for them. jsdom's Range
// has no getBoundingClientRect at all -- there is no layout to report -- so this
// defines the method rather than spying on one.
function stubRects(rects: Partial<DOMRect>[]): void {
  let index = 0;

  Range.prototype.getBoundingClientRect = () => {
    const rect = rects[index] ?? {};
    index += 1;

    return { top: 0, left: 0, width: 1, height: 30, ...rect } as DOMRect;
  };
}

function headline(text: string) {
  const host = document.createElement("h1");
  const ink = document.createElement("span");

  ink.textContent = text;
  host.append(ink);
  vi.spyOn(host, "getBoundingClientRect").mockReturnValue({
    top: 100,
    left: 50,
  } as DOMRect);

  return { host, ink };
}

afterEach(() => {
  vi.restoreAllMocks();
  delete (Range.prototype as Partial<Range>).getBoundingClientRect;
});

describe("glyphLines", () => {
  /**
   * The baseline is where the whole thing lives or dies: CSS centres the content
   * area in the line box and splits the leading, so the baseline is
   * half-leading + ascent below the top of the box. 30px box, 24px content, 20px
   * ascent -> 3 + 20 = 23 below the top, and the top is 100 above the h1's own.
   */
  it("puts each line's baseline where the line box puts it", () => {
    stubFont();
    stubRects([
      { top: 100, left: 60 },
      { top: 100, left: 70 },
      { top: 130, left: 60 },
    ]);
    const { host, ink } = headline("abc");

    expect(glyphLines(ink, host)).toEqual([
      { text: "ab", x: 10, y: 23 },
      { text: "c", x: 10, y: 53 },
    ]);
  });

  // Subpixel layout can put two characters of one line a fraction of a pixel
  // apart. A new line is a whole line-height away, so the tolerance is 1px.
  it("keeps a line together across a subpixel step", () => {
    stubFont();
    stubRects([{ top: 100 }, { top: 100.4 }, { top: 100.9 }]);
    const { host, ink } = headline("abc");

    expect(glyphLines(ink, host)).toHaveLength(1);
  });

  // The space a line break collapses measures nothing and belongs to no line --
  // but it is still a character of the string, so the slice has to span it.
  it("spans a collapsed break character without starting a line for it", () => {
    stubFont();
    stubRects([
      { top: 100, left: 60 },
      { top: 0, left: 0, width: 0, height: 0 },
      { top: 130, left: 60 },
    ]);
    const { host, ink } = headline("a b");

    expect(glyphLines(ink, host).map((line) => line.text)).toEqual(["a", "b"]);
  });

  // No text node to measure: the headline is rendered with no words in it, or
  // has not rendered yet. Nothing to mask, so nothing is claimed.
  it("measures nothing when there is no text", () => {
    stubFont();
    const { host, ink } = headline("");

    expect(glyphLines(ink, host)).toEqual([]);
  });

  /**
   * No 2D canvas means no font metrics, and a baseline guessed without them
   * would put the mask off the words. The caller reads [] as "not measured" and
   * leaves the headline in its ordinary ink, which is the right answer: better
   * plain white than a fill in the wrong place.
   */
  it("measures nothing when the font cannot be measured", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    stubRects([{ top: 100 }]);
    const { host, ink } = headline("a");

    expect(glyphLines(ink, host)).toEqual([]);
  });
});
