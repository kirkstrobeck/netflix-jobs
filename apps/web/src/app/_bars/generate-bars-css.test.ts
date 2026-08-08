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

  // The entrance and the walk live on separate elements. Sharing one element
  // meant one animation list and one play-state governing both, which is what
  // let the fade appear to hold a bar at a single transform.
  it("keeps the fade and the walk on separate elements", () => {
    const css = generateBarsCss();
    const fade = css.match(/\.bars__bar--0 \{[^}]*\}/)?.[0] ?? "";
    const walk = css.match(/\.bars__mover--0 \{[^}]*\}/)?.[0] ?? "";

    expect(fade).toContain("bars-fade-in");
    expect(fade).not.toContain("bars-bar-0");
    expect(walk).toContain("bars-bar-0");
    expect(walk).not.toContain("bars-fade-in");
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
