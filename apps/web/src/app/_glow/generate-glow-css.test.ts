import { describe, expect, it, vi } from "vitest";

import { generateGlowCss } from "@/app/_glow/generate-glow-css";
import { ORB_COUNT } from "@/app/_glow/glow-math";
import { PAUSED_CLASS } from "@/app/_motion/pause-when-idle";

describe("generateGlowCss", () => {
  it("emits wash, keyframes, rules, and reduced-motion", () => {
    const css = generateGlowCss();
    expect(css).toContain(".glow");
    expect(css).toContain("linear-gradient(to top in oklab");
    expect(css).toContain(`@keyframes glow-x-0`);
    expect(css).toContain(`@keyframes glow-y-${ORB_COUNT - 1}`);
    expect(css).toContain(".glow__orb--0");
    expect(css).toContain("filter: blur(3px)");
    expect(css).toContain("prefers-reduced-motion: reduce");
  });

  // Centering an orb on its walk point is a constant, so it is stated once per
  // orb as a negative margin instead of once per keyframe stop. The literal
  // `translate(-50%, 0)` the stops used to each carry was a fifth of the sheet.
  it("centers each orb with a margin, not with a per-stop transform", () => {
    const css = generateGlowCss();

    expect(css).not.toContain("translate(-50%, 0)");
    // width: 90% -> margin-left: -45%, which is the same -50% of the same box.
    expect(css).toContain("width: 90%; height: 277%; margin-left: -45%;");
    expect(css.match(/margin-left: -/g)?.length).toBe(ORB_COUNT);
  });

  /**
   * THE SIZE OF THIS FILE IS THE POINT.
   *
   * It was 785KB, render-blocking, in the head of every page, for an effect
   * that lives in the footer: 9,905 keyframe stops, one per hop of a 230-second
   * walk. The stops are now two loops per orb of about 26 seconds each, on two
   * elements, and the browser multiplies them -- so the drift is as long as it
   * ever was and the sheet is a fifth of the size.
   *
   * The guard is on the stop count rather than the byte count, because that is
   * the thing that regresses: lengthen a loop in glow-tunables.ts and this fails
   * before the file goes back over a megabyte.
   */
  it("spends a few thousand keyframe stops, not ten thousand", () => {
    const stops = generateGlowCss().match(/^ +[\d.]+% \{/gm) ?? [];

    expect(stops.length).toBeLessThan(4000);
    // Both tracks, per orb, and nothing sharing one.
    expect(generateGlowCss().match(/@keyframes glow-[xy]-/g)?.length).toBe(
      ORB_COUNT * 2,
    );
  });

  // The blob is the ::before, and it has its own animation. Pausing only the
  // frame would leave it climbing inside a box that had stopped.
  it("drives the frame and the light it holds as two separate tracks", () => {
    const css = generateGlowCss();

    expect(css).toContain(".glow__orb--0 { animation: glow-x-0 ");
    expect(css).toContain(".glow__orb--0::before { width:");
    expect(css).toContain("animation: glow-y-0 ");
  });

  // Only the orbs stop. The wash is a static gradient, and pausing it would mean
  // the footer's red ground disappeared as you scrolled away from it.
  it("pauses the orbs while the region is idle, leaving the wash painted", () => {
    const css = generateGlowCss();

    expect(css).toContain(
      `.glow.${PAUSED_CLASS} .glow__orb,\n.glow.${PAUSED_CLASS} .glow__orb::before {\n  animation-play-state: paused;\n}`,
    );
    expect(css).not.toContain(`.glow.${PAUSED_CLASS} .glow__wash`);
  });
});

describe("generateGlowCss without blur", () => {
  it("omits the filter when blur is zero", async () => {
    vi.resetModules();
    vi.doMock("@/app/_glow/glow-math", async () => {
      const actual = await vi.importActual<
        typeof import("@/app/_glow/glow-math")
      >("@/app/_glow/glow-math");
      return { ...actual, ORBS_BLUR_PX: 0 };
    });
    const { generateGlowCss: generate } = await import(
      "@/app/_glow/generate-glow-css"
    );
    const css = generate();
    expect(css).not.toContain("filter: blur");
    vi.doUnmock("@/app/_glow/glow-math");
    vi.resetModules();
  });
});
