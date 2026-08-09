import { afterEach, describe, expect, it, vi } from "vitest";

import { locate, locationGranted } from "@/lib/geo/locate";

afterEach(() => {
  vi.unstubAllGlobals();
});

const withGeolocation = (getCurrentPosition: unknown) =>
  vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });

describe("locate", () => {
  it("resolves a coarsened position", async () => {
    withGeolocation((ok: (p: unknown) => void) =>
      ok({ coords: { latitude: 37.234567, longitude: -121.987654 } }),
    );

    await expect(locate()).resolves.toEqual({ fix: { lat: 37.23, lng: -121.99 } });
  });

  // The battery/latency choice, asserted because it is easy to flip by accident
  // and the answer is rounded to 50km rings either way.
  it("does not power up the GPS for a rooftop fix", async () => {
    const getCurrentPosition = vi.fn(
      (...args: [ok: (p: unknown) => void, fail: unknown, options: unknown]) =>
        args[0]({ coords: { latitude: 0.1, longitude: 0.1 } }),
    );
    withGeolocation(getCurrentPosition);

    await locate();

    expect(getCurrentPosition.mock.calls[0][2]).toMatchObject({
      enableHighAccuracy: false,
    });
  });

  it.each([
    [1, "denied"],
    [2, "unavailable"],
    [3, "timeout"],
    [99, "unavailable"],
  ])("reports error code %i as %s", async (code, failure) => {
    withGeolocation((_ok: unknown, fail: (e: { code: number }) => void) =>
      fail({ code }),
    );

    await expect(locate()).resolves.toEqual({ failure });
  });

  // Geolocation is absent over plain HTTP in every current engine, which is a
  // real deployment rather than a hypothetical old browser.
  it("says unsupported when the API is not there", async () => {
    vi.stubGlobal("navigator", {});

    await expect(locate()).resolves.toEqual({ failure: "unsupported" });
  });

  it("says unsupported when there is no navigator at all", async () => {
    vi.stubGlobal("navigator", undefined);

    await expect(locate()).resolves.toEqual({ failure: "unsupported" });
  });
});

describe("locationGranted", () => {
  it("is true only when the permission is already granted", async () => {
    vi.stubGlobal("navigator", {
      permissions: { query: vi.fn().mockResolvedValue({ state: "granted" }) },
    });

    await expect(locationGranted()).resolves.toBe(true);
  });

  // "prompt" is the state that WOULD raise a dialog, so it has to read as no --
  // this is the check that stops a shared ?sort=near link prompting on load.
  it.each(["prompt", "denied"])("is false while the state is %s", async (state) => {
    vi.stubGlobal("navigator", {
      permissions: { query: vi.fn().mockResolvedValue({ state }) },
    });

    await expect(locationGranted()).resolves.toBe(false);
  });

  it("is false when the browser has no Permissions API", async () => {
    vi.stubGlobal("navigator", {});

    await expect(locationGranted()).resolves.toBe(false);
  });

  it("is false when there is no navigator at all", async () => {
    vi.stubGlobal("navigator", undefined);

    await expect(locationGranted()).resolves.toBe(false);
  });

  // Safari shipped Permissions without a geolocation descriptor for years and
  // throws on the query. "We could not tell" falls on the side that does not
  // prompt.
  it("is false when the query throws", async () => {
    vi.stubGlobal("navigator", {
      permissions: { query: vi.fn().mockRejectedValue(new Error("unsupported")) },
    });

    await expect(locationGranted()).resolves.toBe(false);
  });
});
