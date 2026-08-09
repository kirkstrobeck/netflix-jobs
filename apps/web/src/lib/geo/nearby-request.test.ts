import { afterEach, describe, expect, it, vi } from "vitest";

import { requestNearby } from "@/lib/geo/nearby-request";

afterEach(() => {
  vi.unstubAllGlobals();
});

const FIX = { lat: 37.23, lng: -121.96 };

describe("requestNearby", () => {
  it("returns the rings the server sent", async () => {
    const json = vi.fn().mockResolvedValue({
      bucketKm: 50,
      buckets: { "us-los-gatos": 0 },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json }));

    await expect(requestNearby(FIX)).resolves.toEqual({ "us-los-gatos": 0 });
  });

  it("posts the position in the body", async () => {
    const json = vi.fn().mockResolvedValue({ bucketKm: 50, buckets: {} });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json });
    vi.stubGlobal("fetch", fetchMock);

    await requestNearby(FIX);

    expect(fetchMock).toHaveBeenCalledWith("/api/nearby", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(FIX),
    });
  });

  // Null, not a throw. There is one thing to do about a failure either way --
  // keep showing newest and say so -- and a rejected promise here would surface
  // as an unhandled rejection in the offline case, which is the case that
  // actually happens.
  it("is null when the server refuses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400 }));

    await expect(requestNearby(FIX)).resolves.toBeNull();
  });

  it("is null when the network is gone", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));

    await expect(requestNearby(FIX)).resolves.toBeNull();
  });
});
