import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UltraFillCanvas } from "@/app/_ultra/ultra-fill-canvas";

// The session itself is ultra-fill.test.ts's subject -- WebGPU, and what the
// canvas is told when there is none. What is under test HERE is the wiring: that
// a mounted canvas gets a session, that the two events that drop a WebGPU
// surface repaint it, and that unmounting takes all three back.
const session = { poke: vi.fn(), stop: vi.fn() };
const startUltraFill = vi.fn(() => session);

// jsdom has no IntersectionObserver. This one hands the callback back so a test
// can say "now it is on screen" without a layout engine.
const observers: { fire: (isIntersecting: boolean) => void; disconnect: () => void }[] = [];

vi.stubGlobal(
  "IntersectionObserver",
  class {
    constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
      observers.push({
        fire: (isIntersecting) => callback([{ isIntersecting }]),
        disconnect: () => {},
      });
    }
    observe() {}
    disconnect() {}
  },
);

vi.mock("@/lib/ultra/ultra-fill", () => ({
  startUltraFill: (...args: unknown[]) => startUltraFill(...(args as [])),
}));

// No global auto-cleanup in this suite, and these tests listen on window: a
// component left mounted by an earlier test would answer the next one's resize.
afterEach(cleanup);

beforeEach(() => {
  observers.length = 0;
  session.poke.mockClear();
  session.stop.mockClear();
  startUltraFill.mockClear();
});

describe("UltraFillCanvas", () => {
  it("starts a fill on the canvas it mounted", () => {
    const { container } = render(<UltraFillCanvas intensity={3} />);

    expect(startUltraFill).toHaveBeenCalledWith(container.querySelector("canvas"), {
      intensity: 3,
    });
  });

  // The fill is uniform, so one texel is the whole image and CSS scales it. A
  // canvas sized to the headline would be a resize observer and dpr maths for an
  // identical result.
  it("stays 1x1, decorative and out of the pointer's way", () => {
    const canvas = render(<UltraFillCanvas />).container.querySelector("canvas");

    expect(canvas?.width).toBe(1);
    expect(canvas?.height).toBe(1);
    expect(canvas?.getAttribute("aria-hidden")).toBe("true");
  });

  it("takes no class beyond its own when given none", () => {
    const { container } = render(<UltraFillCanvas />);

    expect(container.querySelector("canvas")?.className).toBe("ultra-fill");
  });

  it("keeps its own class when given one", () => {
    const { container } = render(<UltraFillCanvas className="ultra__fill" />);

    expect(container.querySelector("canvas")?.className).toBe("ultra-fill ultra__fill");
  });

  /**
   * WebGPU surfaces are dropped on tab restore and on resize, and a dropped
   * surface paints nothing -- which, through a mask, is an invisible headline
   * rather than a dim one.
   */
  it("repaints when the surface may have been dropped", () => {
    render(<UltraFillCanvas />);

    window.dispatchEvent(new Event("resize"));
    document.dispatchEvent(new Event("visibilitychange"));

    expect(session.poke).toHaveBeenCalledTimes(2);
  });

  /**
   * Scrolling away and back is the third way a surface is found empty, and the
   * one nothing answered: measured over three scroll cycles on the running page,
   * no repaint fired at all on re-entry.
   *
   * It repaints and does NOT reallocate. The device, the surface and the canvas
   * outlive the scroll -- an Ultra fill is one flat clear pass, so there is
   * nothing to park off screen and everything to lose by freeing it. That is the
   * opposite of the bars and the glow, which are continuous keyframe animations
   * and do pause off screen.
   */
  it("repaints on re-entry, and never tears the session down for a scroll", () => {
    render(<UltraFillCanvas />);
    session.poke.mockClear();

    observers[0].fire(false);
    expect(session.poke).not.toHaveBeenCalled();

    observers[0].fire(true);
    expect(session.poke).toHaveBeenCalledTimes(1);
    expect(session.stop).not.toHaveBeenCalled();
    expect(startUltraFill).toHaveBeenCalledTimes(1);
  });

  it("stops the fill and both listeners on unmount", () => {
    const view = render(<UltraFillCanvas />);

    view.unmount();
    window.dispatchEvent(new Event("resize"));
    document.dispatchEvent(new Event("visibilitychange"));

    expect(session.stop).toHaveBeenCalledTimes(1);
    expect(session.poke).not.toHaveBeenCalled();
  });
});
