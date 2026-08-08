import { render, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MotionRegion } from "@/app/_motion/motion-region";
import { PAUSED_CLASS, usePauseWhenIdle } from "@/app/_motion/pause-when-idle";

// jsdom has no IntersectionObserver, so the test supplies one and keeps a handle
// on every instance to drive callbacks and to assert the teardown.
type Instance = {
  callback: IntersectionObserverCallback;
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
};

let instances: Instance[] = [];

function intersect(instance: Instance, isIntersecting: boolean) {
  instance.callback(
    [{ isIntersecting } as IntersectionObserverEntry],
    {} as IntersectionObserver,
  );
}

function setHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", { configurable: true, value: hidden });
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  instances = [];
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        const instance: Instance = {
          callback,
          observe: vi.fn(),
          disconnect: vi.fn(),
        };
        instances.push(instance);
        Object.assign(this, instance);
      }
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  setHidden(false);
});

describe("usePauseWhenIdle", () => {
  it("starts paused and observes the node it is attached to", () => {
    const { container } = render(<MotionRegion className="bars">x</MotionRegion>);
    const node = container.firstElementChild!;

    expect(instances).toHaveLength(1);
    expect(instances[0].observe).toHaveBeenCalledWith(node);
    // Nothing has reported the element visible yet, so it must not animate.
    expect(node.classList.contains(PAUSED_CLASS)).toBe(true);
  });

  it("resumes on screen and pauses again off screen", () => {
    const { container } = render(<MotionRegion className="glow">x</MotionRegion>);
    const node = container.firstElementChild!;

    intersect(instances[0], true);
    expect(node.classList.contains(PAUSED_CLASS)).toBe(false);

    intersect(instances[0], false);
    expect(node.classList.contains(PAUSED_CLASS)).toBe(true);
  });

  it("pauses a fully visible region when its tab goes to the background", () => {
    const { container } = render(<MotionRegion className="glow">x</MotionRegion>);
    const node = container.firstElementChild!;

    intersect(instances[0], true);
    expect(node.classList.contains(PAUSED_CLASS)).toBe(false);

    setHidden(true);
    expect(node.classList.contains(PAUSED_CLASS)).toBe(true);

    setHidden(false);
    expect(node.classList.contains(PAUSED_CLASS)).toBe(false);
  });

  it("disconnects the observer and drops the listener on unmount", () => {
    const removeListener = vi.spyOn(document, "removeEventListener");
    const { unmount } = render(<MotionRegion className="bars">x</MotionRegion>);

    unmount();

    expect(instances[0].disconnect).toHaveBeenCalledTimes(1);
    expect(removeListener).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function),
    );
    removeListener.mockRestore();
  });

  // The legacy callback-ref contract: React detaches through the returned
  // cleanup, so a null call has nothing to wire up and must not observe.
  it("sets nothing up when handed no node", () => {
    const { result } = renderHook(() => usePauseWhenIdle<HTMLDivElement>());

    expect(result.current(null)).toBeUndefined();
    expect(instances).toHaveLength(0);
  });

  // The listener is torn down, not merely orphaned: firing the event after
  // unmount must not touch the detached node.
  it("stops responding to visibility changes once unmounted", () => {
    const { container, unmount } = render(
      <MotionRegion className="bars">x</MotionRegion>,
    );
    const node = container.firstElementChild!;
    intersect(instances[0], true);
    unmount();

    setHidden(true);

    expect(node.classList.contains(PAUSED_CLASS)).toBe(false);
  });
});
