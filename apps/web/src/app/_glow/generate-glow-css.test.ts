import { describe, expect, it, vi } from "vitest";

import { generateGlowCss } from "@/app/_glow/generate-glow-css";
import { ORB_COUNT } from "@/app/_glow/glow-math";
import { PAUSED_CLASS } from "@/app/_motion/pause-when-idle";

describe("generateGlowCss", () => {
  it("emits wash, keyframes, rules, and reduced-motion", () => {
    const css = generateGlowCss();
    expect(css).toContain(".glow");
    expect(css).toContain("linear-gradient(to top in oklab");
    expect(css).toContain(`@keyframes glow-orb-0`);
    expect(css).toContain(`@keyframes glow-orb-${ORB_COUNT - 1}`);
    expect(css).toContain(".glow__orb--0");
    expect(css).toContain("filter: blur(3px)");
    expect(css).toContain("prefers-reduced-motion: reduce");
  });

  // Centering an orb on its walk point is a constant, so it is stated once per
  // orb as a negative margin instead of once per keyframe stop. There are ~12k
  // stops; the literal `translate(-50%, 0)` they used to each carry was a fifth
  // of the whole stylesheet.
  it("centers each orb with a margin, not with a per-stop transform", () => {
    const css = generateGlowCss();

    expect(css).not.toContain("translate(-50%, 0)");
    // width: 90% -> margin-left: -45%, which is the same -50% of the same box.
    expect(css).toContain("width: 90%; height: 277%; margin-left: -45%;");
    expect(css.match(/margin-left: -/g)?.length).toBe(ORB_COUNT);
  });

  // Only the orbs stop. The wash is a static gradient, and pausing it would mean
  // the footer's red ground disappeared as you scrolled away from it.
  it("pauses the orbs while the region is idle, leaving the wash painted", () => {
    const css = generateGlowCss();

    expect(css).toContain(
      `.glow.${PAUSED_CLASS} .glow__orb {\n  animation-play-state: paused;\n}`,
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
