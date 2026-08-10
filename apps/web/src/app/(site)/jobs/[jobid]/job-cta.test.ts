import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { readCss, rule } from "@/app/(site)/css-rule";

const cta = readCss("jobs/[jobid]/job-cta.css");
const note = readCss("jobs/[jobid]/share-note.css");
const shell = readCss("job-shell.css");

/**
 * The numbers behind these rules are measurements, not preferences, and the
 * measuring is done in a browser (tools/probe/cta.mjs, 200 frames driven with
 * Animation.currentTime). What a text assertion can do is stop the rules from
 * being quietly undone -- swapped back to --hairline, or to an opacity hover --
 * without anyone re-running the probe.
 */
describe("the edge that survives the bars", () => {
  /**
   * The hero's backdrop runs rgb(41,3,5) to rgb(143,2,11) as the bars overlap,
   * and --accent measured 3.95:1 down to 2.01:1 against it -- no boundary at
   * all for much of the cycle. No red fixes that: the brightest possible red
   * reaches 2.41:1 at the bright end. So the boundary is a rim.
   */
  it("rims both controls, and with the bright token rather than --hairline", () => {
    const body = rule(cta, ".apply-button,\n.share-button");

    expect(body).toContain("border: 1px solid var(--hairline-bright)");
    expect(shell).toContain("--hairline-bright: rgba(255, 255, 255, 0.7)");
  });

  // 14% white over --accent computes to rgb(233,43,53), which measures 2.79:1
  // at the brightest frame. It is the right token between two near-black
  // surfaces and the wrong one here, so it must not creep back.
  it("does not reach for the near-black hairline on this backdrop", () => {
    expect(cta).not.toContain("solid var(--hairline)");
  });

  /**
   * The secondary control is an opaque plate. A transparent one would let the
   * bars walk through it, which moves its label's contrast with them.
   */
  it("gives the secondary control a fill that does not sample the red", () => {
    expect(rule(cta, ".share-button")).toContain("background: var(--surface)");
  });
});

/**
 * The other half of the measurement, and the one the rules above did not cover:
 * the labels ON the controls, not the edge around them.
 *
 * Read off the painted glyphs at 1280 with tools/probe/label.mjs -- the
 * brightest glyph pixel against the control's own fill, so antialiasing and the
 * webfont are in the number rather than assumed away:
 *
 *   .share-button   rest 18.89:1   hover 16.38:1   -- never a contrast problem
 *   .apply-button   rest  4.79:1   hover  5.91:1   -- was 4.32:1 on hover
 *
 * One size for the pair, and it is 19px because the two read as a pair and
 * because 16px on saturated red was the smallest, weakest text in a hero whose
 * title runs to 3.5rem. 19px/700 also crosses WCAG's 18.66px-bold line, so the
 * apply label is held to 3:1 rather than 4.5:1 -- a consequence of the size, not
 * a reason for it. What moved the absolute number is the hover rule.
 */
describe("the labels on the controls", () => {
  it("sets one size for the pair, over the large-text line", () => {
    const body = rule(cta, ".apply-button,\n.share-button");

    expect(body).toContain("font-size: 1.1875rem");
    // 1.1875rem is 19px, and WCAG's "large scale" is 14pt bold = 18.66px.
    expect(1.1875 * 16).toBeGreaterThanOrEqual(18.66);
    expect(rule(cta, ".apply-button")).toContain("font-weight: 700");
  });

  // Neither control states a size of its own. What separates primary from
  // secondary here is the fill, the weight and the inline padding -- the note
  // on .share-button says so -- and a size on either one would add a fourth
  // difference that nothing asked for. With the copy confirmation moved to
  // share-note.css, the pair's is now the ONLY font-size in this file, so the
  // count is exact rather than a budget.
  it("states that size once", () => {
    expect(cta.match(/font-size:/g)).toHaveLength(1);
    expect(rule(cta, ".apply-button")).not.toContain("font-size");
    expect(rule(cta, ".share-button")).not.toContain("font-size");
  });
});

describe("hover strengthens the edge rather than dissolving it", () => {
  /**
   * `opacity: 0.88` composited the whole button with whatever was behind it, so
   * pointing at it blended it INTO the bars -- at the one moment it most needs
   * to be found. The lift is opaque now and the rim goes to full white.
   */
  it("lifts opaquely and never with opacity", () => {
    expect(rule(cta, ".apply-button:hover,\n.share-button:hover")).toContain(
      "border-color: #fff",
    );
    expect(rule(cta, ".apply-button:hover")).toContain("color-mix");
    expect(cta).not.toContain("opacity: 0.88");
  });

  /**
   * The primary's hover DEEPENS its fill; the secondary's lifts. That is not an
   * inconsistency to be tidied away, it is the only direction each one can go.
   *
   * The apply button carries a white label. Mixing white into --accent to keep
   * the plate off the bars moved the fill toward the label: rgb(233,43,53),
   * where white measures 4.32:1 -- under AA, in the state the label is being
   * read in. Mixing black lands on rgb(202,8,18) and 5.91:1. The share button
   * cannot mirror it: --surface is eight luminance steps off black, so
   * deepening would leave the control nothing but its rim, and its label has
   * 16:1 in either state anyway.
   *
   * Pinned as a direction rather than a colour so a retune of --accent still
   * has to answer the question this fixed.
   */
  it("moves the primary's fill away from its own label, not toward it", () => {
    expect(rule(cta, ".apply-button:hover")).toContain(
      "background: color-mix(in srgb, #000 12%, var(--accent))",
    );
    expect(rule(cta, ".apply-button:hover")).not.toContain("#fff");
    expect(rule(cta, ".share-button:hover")).toContain("#fff 8%");
  });

  // The house rule: instant on the way in, a fade only on the way out.
  it("arrives instantly and fades only on the way out", () => {
    expect(rule(cta, ".apply-button,\n.share-button")).toContain("transition:");
    expect(rule(cta, ".apply-button:hover,\n.share-button:hover")).toContain(
      "transition-duration: 0s",
    );
  });
});

describe("the copy confirmation", () => {
  /**
   * visibility rather than a mount, so the slot holds its space and confirming
   * a copy cannot move the control that was just pressed -- and so the note
   * enters and leaves the accessibility tree, which is what gives the live
   * region something to announce.
   *
   * The delay on the way out is load-bearing: opacity fades first and
   * visibility flips after it, or the note is yanked out mid-fade.
   */
  it("fades out, and is not pulled out from under its own fade", () => {
    const off = rule(note, ".share-note");

    expect(off).toContain("visibility: hidden");
    expect(off).toContain("transition: opacity 240ms ease, visibility 0s linear 240ms");
  });

  it("appears at once", () => {
    const on = rule(note, ".share-note--on");

    expect(on).toContain("visibility: visible");
    expect(on).toContain("transition-duration: 0s");
    expect(on).toContain("transition-delay: 0s");
  });

  /**
   * These rules only exist if something imports the file they are in, and a
   * plain .css file under app/ is inert until a page, layout or component
   * imports it. Splitting them out of job-cta.css is exactly the move that can
   * drop that import: the rules read fine, the assertions above still pass
   * against the text, and the note silently renders unstyled -- permanently
   * visible, wrong colour, no fade -- because nothing pulled the sheet in.
   *
   * So the seam is pinned at the import rather than only at the declarations.
   */
  it("is on a sheet the page actually imports", () => {
    const page = readFileSync(
      join(process.cwd(), "src/app/(site)/jobs/[jobid]/page.tsx"),
      "utf8",
    );

    expect(page).toContain('import "@/app/(site)/jobs/[jobid]/share-note.css"');
  });
});
