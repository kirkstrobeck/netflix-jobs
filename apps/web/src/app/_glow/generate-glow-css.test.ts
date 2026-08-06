import { describe, expect, it, vi } from "vitest";

import { generateGlowCss } from "@/app/_glow/generate-glow-css";
import { ORB_COUNT } from "@/app/_glow/glow-math";

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
