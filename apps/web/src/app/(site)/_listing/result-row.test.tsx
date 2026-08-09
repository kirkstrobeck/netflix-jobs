import { describe, expect, it } from "vitest";

import { readCss, rule as ruleIn } from "@/app/(site)/css-rule";

// The row's interaction state is entirely CSS -- there is no class toggle and no
// JavaScript -- so the stylesheet is the thing under test.
const css = readCss("_listing/result-row.css");
const rule = (selector: string) => ruleIn(css, selector);

const ON = ".result:is(:hover, :has(.result__link:focus-visible))";

describe("the row's mark", () => {
  /**
   * THE POINT OF THIS FILE. The row used to carry two marks -- a rule standing
   * in the gutter and an underline under the title -- and neither of them
   * described the row. One frame does, and the count is the assertion: if a
   * second mark is ever added back, this is what says so.
   */
  it("is exactly one mark, and it frames the whole row", () => {
    expect(rule(".result::after")).toContain("border: 2px solid var(--accent)");
    expect(rule(".result::after")).toContain("inset-block: 0");
    expect(rule(".result::after")).toContain("inset-inline: -0.75rem");

    // The marks it replaced, and the one it was chosen over.
    expect(css).not.toContain("text-decoration-color");
    expect(css).not.toContain("inset-inline-start");
    expect(css).not.toContain("linear-gradient");
    expect(css).not.toContain("::before");
  });

  // Scoped to .result, so hovering the date lights the row exactly as hovering
  // the title does. Nothing keys off the link.
  it("is keyed off the row, never off the title link", () => {
    expect(rule(`${ON}::after`)).not.toBe("");
    expect(css).not.toContain(".result__link:hover");
  });

  /**
   * Pointer and keyboard are ONE declaration, not two that agree today. There
   * is one :is() in the file and it paints the only state there is, which is
   * what "hover and focus read as the same affordance" has to mean in CSS.
   */
  it("gives pointer and keyboard the identical treatment", () => {
    const paired = css.match(/:is\(:hover, :has\(\.result__link:focus-visible\)\)/g);

    expect(paired).toHaveLength(1);
  });

  // :focus-within would also match after a mouse click, leaving a row lit that
  // nobody is on.
  it("uses :focus-visible for the keyboard state, never :focus-within", () => {
    expect(css).toContain(":has(.result__link:focus-visible)");
    expect(css).not.toContain(":focus-within");
  });

  // The style guide, both halves: the base rule owns the way out and carries a
  // duration; the state rule owns the way in and zeroes it.
  it("appears instantly and only fades on the way out", () => {
    expect(rule(".result::after")).toContain("transition: opacity 150ms ease");
    expect(rule(`${ON}::after`)).toContain("transition-duration: 0s");
  });

  // Opacity only. Nothing may reflow and nothing may move -- twenty rows of a
  // mark that grows would leave a trail of movement behind a pointer running
  // down the list, drawing the eye to the row it has just left.
  it("moves nothing, so it needs no reduced-motion branch", () => {
    expect(rule(`${ON}::after`)).not.toMatch(/padding|margin|border|font-size/);
    expect(css).not.toContain("transform");
    expect(css).not.toContain("prefers-reduced-motion");
  });

  /**
   * The frame is drawn with a forced colour rather than left to whatever the UA
   * picks for a border, because removing the link's own outline below is only
   * defensible while something visible stands in its place -- in every mode.
   */
  it("survives forced colours", () => {
    expect(css).toContain("@media (forced-colors: active)");
    expect(rule(".result::after")).toContain("opacity: 0");
  });
});

describe("the row as the hit area", () => {
  /**
   * Markup and CSS, not a click handler on a div. The anchor's own pseudo
   * element is stretched over the row, so the title stays one real link with
   * one real href and the row gains no second tab stop.
   */
  it("stretches the real link over the whole row", () => {
    expect(rule(".result__link::after")).toContain("position: absolute");
    expect(rule(".result__link::after")).toContain("inset: 0");
    // The positioned ancestor inset: 0 resolves against.
    expect(rule(".result")).toContain("position: relative");
  });

  // The frame must not eat the clicks the overlay exists to catch: it is the
  // later pseudo element, so it paints on top of it.
  it("keeps the frame out of the way of the pointer", () => {
    expect(rule(".result::after")).toContain("pointer-events: none");
  });

  // A ring around the TITLE is a second, smaller answer to the question the
  // frame has already answered, and it is the wrong one: it draws a word where
  // the target is a line.
  it("moves the focus ring off the word and onto the row", () => {
    expect(rule(".result__link:focus-visible")).toContain("outline: none");
    expect(rule(".result__link")).toContain("text-decoration: none");
  });
});
