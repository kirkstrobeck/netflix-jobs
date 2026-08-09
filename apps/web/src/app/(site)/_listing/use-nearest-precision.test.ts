import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  locateMock.mockResolvedValue({ fix: FIX, accuracyM: 30 });
  nearbyMock.mockResolvedValue(RINGS);
  watchMock.mockImplementation(() => () => {});
});

/**
 * The two things the island now carries beyond the rings, both of which exist so
 * that a guessed position is never presented as a known one.
 */
describe("what the island knows about its own precision", () => {
  it("carries the fix's radius through, for the disclosure to read", async () => {
    locateMock.mockResolvedValue({ fix: FIX, accuracyM: 42_000 });

    const { result } = renderHook(() => useNearest("newest"));

    act(() => result.current.request());

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.accuracyM).toBe(42_000);
  });

  // No geocoder is configured, so a device fix has no name and the heading says
  // "nearest to you". The seam is lib/geo/geocoder.ts.
  it("has no place name to offer, and does not invent one", async () => {
    const { result } = renderHook(() => useNearest("newest"));

    act(() => result.current.request());

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.place).toBeNull();
  });

  // Watched from mount, because a denial is only ever lifted in browser UI and
  // PermissionStatus is what reports that without a reload. Watching never
  // prompts -- navigator.permissions.query does not raise a dialog.
  it("reports the permission, and follows it when it changes", async () => {
    let report: (state: "granted" | "denied" | "prompt") => void = () => {};
    watchMock.mockImplementation((onChange) => {
      report = onChange;
      return () => {};
    });

    const { result } = renderHook(() => useNearest("newest"));

    act(() => report("denied"));
    await waitFor(() => expect(result.current.permission).toBe("denied"));

    act(() => report("granted"));
    await waitFor(() => expect(result.current.permission).toBe("granted"));
    // Observing a grant is not the same as acting on one: the button appears,
    // and pressing it is still what fetches a position.
    expect(locateMock).not.toHaveBeenCalled();
  });

  it("stops listening when the listing goes away", () => {
    const detach = vi.fn();
    watchMock.mockImplementation(() => detach);

    renderHook(() => useNearest("newest")).unmount();

    expect(detach).toHaveBeenCalled();
  });
});
