import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BAR_ALPHA, BAR_COUNT } from "@/app/_bars/bars-tunables";
import { readCss, rule } from "@/app/(site)/css-rule";
import { HEADLINE, HomeMasthead } from "@/app/(site)/home-masthead";

const html = () => renderToStaticMarkup(<HomeMasthead />);

// U+2019 needs no HTML escaping, so it reaches the markup as itself.
const decoded = html;

describe("HomeMasthead", () => {
  /**
   * Still one h1, still carrying .masthead__title, and still holding the words.
   * The Ultra treatment adds a masked canvas over the top and moves the ink into
   * a span inside the h1 -- see ultra-headline.tsx -- so what is asserted here is
   * that the heading a crawler, a reader mode and a visitor with no WebGPU get
   * is unchanged: the same element, the same class, the same string.
   */
  it("renders the headline verbatim, in sentence case, as an h1", () => {
    expect(HEADLINE).toBe("Be part of what’s next");
    expect(decoded()).toContain('<h1 class="ultra masthead__title">');
    expect(decoded()).toContain(`<span class="ultra__ink">${HEADLINE}</span>`);
  });

  // Typeset copy: the apostrophe is the right single quote, not the typewriter
  // one. Asserting the codepoint catches a normalising editor as well as a typo.
  it("uses U+2019 for the apostrophe, never ASCII U+0027", () => {
    expect(HEADLINE).toContain("’");
    expect(HEADLINE).not.toContain("'");
  });

  it("has exactly one h1", () => {
    expect(html().match(/<h1/g)).toHaveLength(1);
  });

  // Reused, not reimplemented: the same <BarsStage> the job masthead mounts.
  it("sits on the shared bars stage, with the headline in the content layer", () => {
    const markup = html();

    expect(markup).toContain('<header class="bars-stage masthead">');
    expect(markup).toContain('class="bars"');
    expect(markup).toContain('class="bars-stage__content');
    expect(markup.indexOf('class="bars"')).toBeLessThan(markup.indexOf("<h1"));
  });

  /**
   * The band spans the page and the column lives inside it -- the same shape
   * .site-header has, and the whole of how the divider under this masthead
   * reaches the edges without a viewport unit.
   *
   * The shell has to be on the CONTENT layer specifically. On the header it
   * would cap the band itself and take the divider back to the column; below
   * the h1 there is nothing left to centre. So the assertion names the element
   * it is on, not just that the class appears somewhere in the markup.
   */
  it("puts the 76rem column inside the band, not around it", () => {
    const markup = html();

    expect(markup).toContain('<div class="bars-stage__content shell">');
    expect(markup).not.toContain("bars-stage masthead shell");
  });
});

/**
 * ONE RULE SAYS HOW BIG THE HEADLINE IS.
 *
 * The clamp in .masthead__title is the whole answer, so a later override that
 * scales it would split the size across two places and leave neither of them
 * true. This pins the clamp itself, and pins that nothing else sets a size on
 * the headline -- which is what makes "change it at the source" enforceable
 * rather than a habit.
 *
 * All three terms are in the assertion because the middle one is the slope: a
 * rescale that moves only the floor and the ceiling changes the shape of the
 * curve instead of moving it.
 */
describe("the headline's size lives in one clamp", () => {
  const css = readCss("home-masthead.css");

  it("states the whole ramp in .masthead__title and nowhere else", () => {
    expect(rule(css, ".masthead__title")).toContain(
      "font-size: clamp(2.925rem, 1.71rem + 5.58vw, 5.85rem)",
    );
    expect(css.match(/font-size:/g)).toHaveLength(1);
  });

  /**
   * The divider is .masthead's own border, so the band has to be the full width
   * of the page -- and it is, because <main> has no cap on it and this is a
   * plain block inside it.
   *
   * No box here is SIZED from the viewport, which is the point: 100vw counts
   * the scrollbar gutter, so the field it used to size overhung the page by the
   * width of the scrollbar and .job-page's overflow-x: clip had to trim it back
   * off. vw in a clamp is a different thing -- fluid type and fluid padding,
   * neither of which can overflow -- so the assertion names the two spellings
   * of the bleed rather than banning the unit.
   */
  it("draws the divider as this band's own border and sizes nothing from the viewport", () => {
    expect(rule(css, ".masthead")).toContain(
      "border-block-end: 1px solid var(--hairline)",
    );
    expect(css).not.toContain("100vw");
    expect(css).not.toContain("-50vw");
  });
});

// The bars move, so the headline has to hold against the worst frame rather than
// a typical one. The worst frame is bounded by the alpha maths: every bar is the
// same flat alpha, so the darkest a stack can make the backdrop is all of them
// over the same pixel. If a future retune raises the count or the alpha past
// what --ink can sit on, this fails and the backdrop needs a scrim.
describe("headline contrast at the worst frame", () => {
  const channel = (c: number) => {
    const s = c / 255;

    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const luminance = ([r, g, b]: number[]) =>
    0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  const contrast = (a: number[], b: number[]) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);

    return (hi + 0.05) / (lo + 0.05);
  };

  const SURFACE = [8, 2, 2];
  const ACCENT = [229, 9, 20];
  const INK = [245, 245, 245];

  it("holds AA with every bar stacked on the same pixel", () => {
    // 1 - (1 - alpha)^n: the composite of n identical translucent layers.
    const ceiling = 1 - Math.pow(1 - BAR_ALPHA, BAR_COUNT);
    const backdrop = ACCENT.map((c, i) => c * ceiling + SURFACE[i] * (1 - ceiling));

    // 15 bars at 0.15 -- the retune from 0.10 raised this from 0.7941. Pinned so
    // the number is a decision, not a drift.
    expect(ceiling).toBeCloseTo(0.9126458, 6);
    expect(contrast(INK, backdrop)).toBeGreaterThan(4.5);
  });

  // Even against flat, fully opaque accent -- darker than the bars can reach --
  // the headline stays legible at its size. This is the floor under the floor.
  it("still clears AA large text against solid accent", () => {
    expect(contrast(INK, ACCENT)).toBeGreaterThan(3);
  });
});
