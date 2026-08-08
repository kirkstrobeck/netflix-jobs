import { describe, expect, it, vi } from "vitest";

import { BAR_COUNT } from "@/app/_bars/bars-tunables";
import { generateBarsCss } from "@/app/_bars/generate-bars-css";

describe("generateBarsCss", () => {
  it("emits keyframes, rules, the blur layer, and reduced-motion", () => {
    const css = generateBarsCss();

    expect(css).toContain("@keyframes bars-bar-0");
    expect(css).toContain(`@keyframes bars-bar-${BAR_COUNT - 1}`);
    expect(css).toContain(".bars__bar--0");
    expect(css).toContain("filter: blur(2px)");
    expect(css).toContain("prefers-reduced-motion: reduce");
  });

  // There is no entrance. Bars are at full strength on first paint, so the walk
  // is the only animation in the effect and nothing animates opacity.
  it("animates nothing but the walk", () => {
    const css = generateBarsCss();
    const shell = css.match(/\.bars__bar--0 \{[^}]*\}/)?.[0] ?? "";
    const walk = css.match(/\.bars__mover--0 \{[^}]*\}/)?.[0] ?? "";

    // Comments stripped: the prose still says a bar "fades" as it walks off the
    // clipped edge, which is a description of the clip, not a declaration.
    const declarations = css.replace(/\/\*[\s\S]*?\*\//g, "");

    expect(shell).toContain("width:");
    expect(shell).not.toContain("animation");
    expect(walk).toContain("bars-bar-0");
    expect(declarations).not.toContain("fade");
    expect(declarations).not.toContain("opacity");
  });

  // X only: the Y slot of every translate3d is a hard 0, so a bar can never
  // drift vertically however the walk math changes.
  it("never translates a bar on Y", () => {
    const calls = generateBarsCss().match(/translate3d\([^)]*\)/g) ?? [];

    expect(calls.length).toBeGreaterThan(0);
    expect(calls.filter((call) => !call.endsWith(", 0, 0)"))).toEqual([]);
  });
});

describe("generateBarsCss without blur", () => {
  it("omits the filter when blur is zero", async () => {
    vi.resetModules();
    vi.doMock("@/app/_bars/bars-tunables", async () => {
      const actual = await vi.importActual<
        typeof import("@/app/_bars/bars-tunables")
      >("@/app/_bars/bars-tunables");
      return { ...actual, BARS_BLUR_PX: 0 };
    });
    const { generateBarsCss: generate } = await import(
      "@/app/_bars/generate-bars-css"
    );

    expect(generate()).not.toContain("filter: blur");

    vi.doUnmock("@/app/_bars/bars-tunables");
    vi.resetModules();
  });
});
