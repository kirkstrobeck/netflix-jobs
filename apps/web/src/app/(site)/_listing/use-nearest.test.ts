import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useNearest } from "@/app/(site)/_listing/use-nearest";
import { locate, locationGranted, watchLocationPermission } from "@/lib/geo/locate";
import { requestNearby } from "@/lib/geo/nearby-request";

vi.mock("@/lib/geo/locate", () => ({
  locate: vi.fn(),
  locationGranted: vi.fn(),
  watchLocationPermission: vi.fn(),
}));

vi.mock("@/lib/geo/nearby-request", () => ({ requestNearby: vi.fn() }));

const locateMock = vi.mocked(locate);
const grantedMock = vi.mocked(locationGranted);
const nearbyMock = vi.mocked(requestNearby);
const watchMock = vi.mocked(watchLocationPermission);

const FIX = { lat: 37.23, lng: -121.96 };
const RINGS = { "us-los-gatos": 0 };

beforeEach(() => {
  vi.clearAllMocks();
  grantedMock.mockResolvedValue(false);
  // Rooftop-grade, so nothing here trips the coarse-accuracy disclosure.
  locateMock.mockResolvedValue({ fix: FIX, accuracyM: 30 });
  nearbyMock.mockResolvedValue(RINGS);
  watchMock.mockImplementation(() => () => {});
});

afterEach(() => vi.clearAllMocks());

describe("useNearest on a first, unsorted load", () => {
  // The rule the island exists for: nothing is asked of the browser until the
  // visitor asks for it.
  it("asks the device for nothing at all", async () => {
    renderHook(() => useNearest("newest"));

    await waitFor(() => expect(grantedMock).not.toHaveBeenCalled());
    expect(locateMock).not.toHaveBeenCalled();
    expect(nearbyMock).not.toHaveBeenCalled();
  });

  it("starts idle with no rings", () => {
    const { result } = renderHook(() => useNearest("newest"));

    expect(result.current.status).toBe("idle");
    expect(result.current.buckets).toBeNull();
  });
});

describe("useNearest when the visitor presses Nearest", () => {
  it("locates, fetches the rings, and reports ready", async () => {
    const { result } = renderHook(() => useNearest("newest"));

    act(() => result.current.request());

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.buckets).toEqual(RINGS);
    expect(nearbyMock).toHaveBeenCalledWith(FIX);
  });

  it("says it is locating while it waits", async () => {
    locateMock.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useNearest("newest"));

    act(() => result.current.request());

    await waitFor(() => expect(result.current.status).toBe("locating"));
  });

  // Every way of not getting a position is now ONE state: there used to be a
  // status per failure mode because each had its own sentence apologising for
  // the list being newest, and those sentences are gone. The one distinction
  // the retry copy still needs is `permission` -- a fact about the browser
  // rather than about this attempt -- covered in use-nearest-precision.test.ts.
  it.each(["denied", "unavailable", "timeout", "unsupported"] as const)(
    "collapses %s to failed, with no rings",
    async (failure) => {
      locateMock.mockResolvedValue({ failure });

      const { result } = renderHook(() => useNearest("newest"));

      act(() => result.current.request());

      await waitFor(() => expect(result.current.status).toBe("failed"));
      expect(result.current.buckets).toBeNull();
      // No position, so nothing was sent anywhere.
      expect(nearbyMock).not.toHaveBeenCalled();
    },
  );

  it("reports failed when the server does not answer", async () => {
    nearbyMock.mockResolvedValue(null);

    const { result } = renderHook(() => useNearest("newest"));

    act(() => result.current.request());

    await waitFor(() => expect(result.current.status).toBe("failed"));
    expect(result.current.buckets).toBeNull();
  });

  it("does not spin the radio again once it holds rings", async () => {
    const { result } = renderHook(() => useNearest("newest"));

    act(() => result.current.request());
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => result.current.request());

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(locateMock).toHaveBeenCalledTimes(1);
  });

  // Nearest, then Newest, then Nearest again leaves two flights in the air.
  // Without the attempt token the first to land wins, which can be the stale one.
  it("ignores an attempt that has been superseded", async () => {
    let settleFirst: (value: { failure: "timeout" }) => void = () => {};
    locateMock.mockReturnValueOnce(
      new Promise((resolve) => {
        settleFirst = resolve;
      }),
    );

    const { result } = renderHook(() => useNearest("newest"));

    act(() => result.current.request());
    act(() => result.current.request());

    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => settleFirst({ failure: "timeout" }));

    await waitFor(() => expect(result.current.status).toBe("ready"));
  });

  // The same race one stage later: the position came back fast and the RINGS
  // are slow. A stale answer would overwrite a good sort.
  it("ignores rings that arrive after a newer attempt", async () => {
    let settleFirst: (rings: null) => void = () => {};
    nearbyMock.mockReturnValueOnce(
      new Promise((resolve) => {
        settleFirst = resolve;
      }),
    );

    const { result } = renderHook(() => useNearest("newest"));

    act(() => result.current.request());
    await waitFor(() => expect(nearbyMock).toHaveBeenCalledTimes(1));

    act(() => result.current.request());
    await waitFor(() => expect(result.current.status).toBe("ready"));

    await act(async () => settleFirst(null));

    expect(result.current.status).toBe("ready");
    expect(result.current.buckets).toEqual(RINGS);
  });
});

describe("useNearest on a shared ?sort=near link", () => {
  // Granted already means fetching a position raises nothing, so the link
  // lands sorted for the person who granted it before.
  it("resolves silently when permission was already given", async () => {
    grantedMock.mockResolvedValue(true);

    const { result } = renderHook(() => useNearest("nearest"));

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.buckets).toEqual(RINGS);
  });

  // `prompt` is the state that would raise a dialog, and arriving on a URL is
  // not a visitor asking for one.
  it("does not prompt when permission has not been given", async () => {
    grantedMock.mockResolvedValue(false);

    const { result } = renderHook(() => useNearest("nearest"));

    await waitFor(() => expect(grantedMock).toHaveBeenCalled());
    expect(locateMock).not.toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
  });

  it("does not act on a permission answer that arrives after unmount", async () => {
    grantedMock.mockResolvedValue(true);

    const { unmount } = renderHook(() => useNearest("nearest"));
    unmount();

    await waitFor(() => expect(grantedMock).toHaveBeenCalled());
    expect(locateMock).not.toHaveBeenCalled();
  });
});
