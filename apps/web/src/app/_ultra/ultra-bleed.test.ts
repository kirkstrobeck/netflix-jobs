import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { rule, stripComments } from "@/app/(site)/css-rule";
import { ULTRA_BLEED } from "@/lib/ultra/ultra-config";

// readCss() resolves under app/(site); this sheet lives beside its components
// in app/_ultra, so the path is stated here rather than bent into that helper.
const ultra = stripComments(
  readFileSync(join(process.cwd(), "src/app/_ultra/ultra.css"), "utf8"),
);

/**
 * THE CLIPPING FIX, PINNED.
 *
 * A mask viewport is a rectangle. Pinned to the text box at inset: 0 it IS the
 * line box, so every glyph that overshoots one -- an accent above the cap line,
 * a descender below the baseline, the tail of a G -- gets a straight edge the
 * letterform does not have. Both overlay layers grow past the box instead.
 */
describe("the Ultra overlay's bleed", () => {
  it("states the growth once, and derives the inset and the size from it", () => {
    expect(rule(ultra, ".ultra")).toContain(`--ultra-bleed: ${ULTRA_BLEED}%`);

    const layers = rule(ultra, ".ultra__mask,\n.ultra__fill");

    expect(layers).toContain("inset: calc(-1 * var(--ultra-bleed))");
    expect(layers).toContain("inline-size: calc(100% + 2 * var(--ultra-bleed))");
    expect(layers).toContain("block-size: calc(100% + 2 * var(--ultra-bleed))");
  });

  /**
   * The trap, and the reason the sizes are not optional. An <svg> is a replaced
   * element: left at inline-size auto it keeps its intrinsic 300x150, ignores
   * the right and bottom insets, and the mask slides off the word instead of
   * growing around it. A negative inset alone is a displacement.
   */
  it("never pins a layer to the box it is supposed to overshoot", () => {
    expect(ultra).not.toContain("inset: 0");
    expect(ultra).not.toContain("inline-size: 100%");
    expect(ultra).not.toContain("block-size: 100%");
  });

  /**
   * At 200% the layers reach over whatever sits beside the heading, so neither
   * may take a click meant for it -- and the mask's own copy of the word must
   * stay out of the selection, or copying the headline yields it twice.
   */
  it("keeps both layers out of the pointer's way, and the mask out of selections", () => {
    expect(rule(ultra, ".ultra__mask,\n.ultra__fill")).toContain(
      "pointer-events: none",
    );
    expect(rule(ultra, ".ultra__mask")).toContain("user-select: none");
  });
});
