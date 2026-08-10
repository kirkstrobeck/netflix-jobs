import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AmbientVideo, drivePlayback } from "@/app/ambient-video";

function mockMediaPlayback(playImpl?: () => Promise<void>) {
  const play = vi
    .spyOn(HTMLMediaElement.prototype, "play")
    .mockImplementation(playImpl ?? (() => Promise.resolve()));
  const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});

  return { play, pause };
}

function mockMatchMedia(initialMatches: boolean) {
  const state = { matches: initialMatches };
  const listeners = new Set<() => void>();

  const mediaQueryList = {
    get matches() {
      return state.matches;
    },
    media: "(prefers-reduced-motion: reduce)",
    addEventListener: (_type: string, listener: () => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: () => void) => {
      listeners.delete(listener);
    },
    setMatches: (value: boolean) => {
      state.matches = value;
      listeners.forEach((listener) => listener());
    },
  };

  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue(mediaQueryList));

  return mediaQueryList;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("AmbientVideo", () => {
  it("plays on mount when motion is not reduced", () => {
    const { play, pause } = mockMediaPlayback();
    mockMatchMedia(false);

    render(<AmbientVideo />);

    expect(play).toHaveBeenCalledTimes(1);
    expect(pause).not.toHaveBeenCalled();
  });

  it("pauses instead of playing when reduced motion is already on", () => {
    const { play, pause } = mockMediaPlayback();
    mockMatchMedia(true);

    render(<AmbientVideo />);

    expect(pause).toHaveBeenCalledTimes(1);
    expect(play).not.toHaveBeenCalled();
  });

  it("pauses when the user enables reduced motion after mount", () => {
    const { pause } = mockMediaPlayback();
    const mediaQueryList = mockMatchMedia(false);

    render(<AmbientVideo />);
    mediaQueryList.setMatches(true);

    expect(pause).toHaveBeenCalledTimes(1);
  });

  it("restarts from the beginning when playback ends", () => {
    const { play } = mockMediaPlayback();
    mockMatchMedia(false);

    const { container } = render(<AmbientVideo />);
    const video = container.querySelector("video") as HTMLVideoElement;
    video.currentTime = 42;
    play.mockClear();

    video.dispatchEvent(new Event("ended"));

    expect(video.currentTime).toBe(0);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("does not restart on end while reduced motion is on", () => {
    const { play } = mockMediaPlayback();
    mockMatchMedia(true);

    const { container } = render(<AmbientVideo />);
    const video = container.querySelector("video") as HTMLVideoElement;
    play.mockClear();

    video.dispatchEvent(new Event("ended"));

    expect(play).not.toHaveBeenCalled();
  });

  it("stops listening once unmounted", () => {
    const { play } = mockMediaPlayback();
    const mediaQueryList = mockMatchMedia(false);

    const { container, unmount } = render(<AmbientVideo />);
    const video = container.querySelector("video") as HTMLVideoElement;

    unmount();
    play.mockClear();

    video.dispatchEvent(new Event("ended"));
    mediaQueryList.setMatches(true);

    expect(play).not.toHaveBeenCalled();
  });

  it("swallows a rejected autoplay attempt instead of throwing", async () => {
    mockMediaPlayback(() => Promise.reject(new Error("NotAllowedError")));
    mockMatchMedia(false);

    expect(() => render(<AmbientVideo />)).not.toThrow();
    await Promise.resolve();
  });
});

// The element is always attached by the time the effect runs, so this branch
// belongs to the helper's contract rather than to anything React does. It is
// what keeps a future caller -- a conditional render, a detached ref -- from
// getting a TypeError instead of a no-op.
describe("drivePlayback without an element", () => {
  it("wires nothing up and hands back no teardown", () => {
    const matchMedia = vi.fn();
    vi.stubGlobal("matchMedia", matchMedia);

    expect(drivePlayback(null)).toBeUndefined();
    expect(matchMedia).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
