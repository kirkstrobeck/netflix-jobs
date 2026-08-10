// Ultra mode - https://UltraDarkMode.com

/**
 * Where each line of a wrapped headline sits, so an SVG <text> can be put on top
 * of it.
 *
 * WHY THIS EXISTS AT ALL
 *
 * The Ultra fill is masked to the letterforms, and the mask has to be an SVG
 * <mask> element inline in the document -- a data-URL mask renders in an
 * isolated context with no access to the page's webfont, and this headline is
 * set in one that next/font loads. The obvious way to put wrapped text in that
 * mask is a <foreignObject> holding the same markup. It does not work: measured
 * in Chromium against the running page, a foreignObject inside a <mask> paints
 * nothing at all -- 0 red pixels through the mask where a plain <rect> gave
 * 91840 and an SVG <text> gave 11744.
 *
 * So the mask is SVG <text>, which does not wrap, and the line breaks have to
 * come from somewhere. They come from the real text: the line boxes of the
 * visible words, read back off the layout that already happened, which is the
 * only source that cannot disagree with what is on screen.
 *
 * The <text> elements state no typography of their own -- they inherit the
 * headline's, being children of it -- so family, size, weight, tracking and
 * casing are the same by construction. Only the position is computed here.
 */

export type GlyphLine = {
  text: string;
  /** Both in the mask SVG's user space -- see `host` in glyphLines below. */
  x: number;
  y: number;
};

type LineRun = { top: number; left: number; height: number; from: number; to: number };

/**
 * The baseline offset inside a line box, from the font's own metrics.
 *
 * CSS puts the content area (ascent + descent) in the middle of the line box and
 * splits the leftover leading above and below it, so the baseline is
 * half-leading + ascent down from the top of the box. Chrome will hand back the
 * ascent and descent of the exact face at the exact size through a 2D canvas,
 * which is the same face the headline is set in.
 */
function fontBox(font: string): { ascent: number; content: number } | null {
  const context = document.createElement("canvas").getContext("2d");

  if (!context) return null;

  context.font = font;
  const metrics = context.measureText("Hxg");

  return {
    ascent: metrics.fontBoundingBoxAscent,
    content: metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent,
  };
}

// One rect per character, grouped by the top of the box it landed in. A
// character the browser collapsed away -- the space at a line break -- measures
// zero on both axes and belongs to no line.
function runs(node: Text, text: string): LineRun[] {
  const range = document.createRange();
  const found: LineRun[] = [];

  for (let index = 0; index < text.length; index += 1) {
    range.setStart(node, index);
    range.setEnd(node, index + 1);
    const rect = range.getBoundingClientRect();
    const open = found.at(-1);

    if (rect.width === 0 && rect.height === 0) continue;

    // Within a pixel: subpixel layout can put two characters of one line a
    // fraction apart, and a new line is a whole line-height away.
    if (open && Math.abs(open.top - rect.top) < 1) {
      open.to = index + 1;
      continue;
    }

    found.push({
      top: rect.top,
      left: rect.left,
      height: rect.height,
      from: index,
      to: index + 1,
    });
  }

  return found;
}

/**
 * `ink` is the visible text. `host` is the MASK SVG, not the heading: the
 * coordinates returned are absolute pixels in that SVG's user space, and
 * ultra.css grows it --ultra-bleed past the heading on every side so no glyph is
 * cut by the edge of the mask viewport. Measuring against the element the
 * coordinates are FOR means the bleed costs no arithmetic here.
 *
 * Returns [] when there is nothing measurable yet -- no text node, or no 2D
 * canvas to read font metrics from -- and the caller leaves the headline in its
 * ordinary ink.
 */
export function glyphLines(ink: HTMLElement, host: Element): GlyphLine[] {
  const node = ink.firstChild;

  if (!(node instanceof Text)) return [];

  const text = node.data;
  const box = fontBox(getComputedStyle(ink).font);

  if (!box) return [];

  const origin = host.getBoundingClientRect();

  return runs(node, text).map((line) => ({
    text: text.slice(line.from, line.to),
    x: line.left - origin.left,
    // Half-leading, then the ascent: the baseline of this line box.
    y: line.top - origin.top + (line.height - box.content) / 2 + box.ascent,
  }));
}
