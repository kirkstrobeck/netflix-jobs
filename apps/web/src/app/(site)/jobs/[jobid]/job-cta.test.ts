import { describe, expect, it } from "vitest";

import { readCss, rule } from "@/app/(site)/css-rule";

const cta = readCss("jobs/[jobid]/job-cta.css");
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
    const off = rule(cta, ".share-note");

    expect(off).toContain("visibility: hidden");
    expect(off).toContain("transition: opacity 240ms ease, visibility 0s linear 240ms");
  });

  it("appears at once", () => {
    const on = rule(cta, ".share-note--on");

    expect(on).toContain("visibility: visible");
    expect(on).toContain("transition-duration: 0s");
    expect(on).toContain("transition-delay: 0s");
  });
});
