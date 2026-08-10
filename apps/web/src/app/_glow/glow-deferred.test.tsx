import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DeferredGlow, loadGlow } from "@/app/_glow/glow-deferred";

// next/dynamic's loader never resolves during a static render, which is the
// behaviour under test: what the server sends is nothing. The mock keeps that
// explicit rather than depending on the real module's timing.
vi.mock("next/dynamic", () => ({
  default: () => function Loading() {
    return null;
  },
}));

describe("DeferredGlow", () => {
  /**
   * The glow's stylesheet is 118,925 bytes on the wire -- 73% of every byte of
   * render-blocking CSS the site served -- for decoration that starts below the
   * fold and is aria-hidden. Loading it with the document costs the largest
   * contentful paint and buys nothing on the first screen.
   *
   * So the server sends none of it. next/dynamic with ssr: false puts the markup
   * and the sheet in a chunk fetched after hydration.
   */
  it("sends nothing from the server", () => {
    expect(renderToStaticMarkup(<DeferredGlow />)).toBe("");
  });

  // And what it defers is the real effect, not a placeholder that forgot to
  // point at it: the chunk resolves to the component that draws the orbs.
  it("loads the glow itself once the chunk lands", async () => {
    const Glow = await loadGlow();

    expect(renderToStaticMarkup(<Glow />)).toContain('class="glow"');
  });
});
