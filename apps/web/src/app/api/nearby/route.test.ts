import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/nearby/route";
import { BUCKET_KM } from "@/lib/geo/metro-bucket";
import { restRpc } from "@/lib/supabase/rpc";

vi.mock("@/lib/supabase/rpc", () => ({ restRpc: vi.fn() }));

const rpcMock = vi.mocked(restRpc);

beforeEach(() => {
  rpcMock.mockClear();
});

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/nearby", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

describe("POST /api/nearby", () => {
  it("answers with a ring per located office", async () => {
    rpcMock.mockResolvedValue([
      { slug: "us-los-angeles", distance_km: 0.4 },
      { slug: "us-burbank", distance_km: 15.5 },
      { slug: "us-new-york", distance_km: 3936 },
    ]);

    const response = await post({ lat: 34.05, lng: -118.24 });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      bucketKm: BUCKET_KM,
      buckets: { "us-los-angeles": 0, "us-burbank": 0, "us-new-york": 78 },
    });
  });

  it("hands the database the position it was given", async () => {
    rpcMock.mockResolvedValue([]);

    await post({ lat: 35.68, lng: 139.65 });

    expect(rpcMock).toHaveBeenCalledWith("sites_by_distance", {
      lat: 35.68,
      lng: 139.65,
    });
  });

  // The answer is rings, never metres and never the position that produced
  // them, so the response cannot be worked backwards into where someone stood.
  it("returns no distances and no coordinates", async () => {
    rpcMock.mockResolvedValue([{ slug: "us-los-gatos", distance_km: 12.3 }]);

    const body = await (await post({ lat: 37.23, lng: -121.96 })).text();

    expect(body).not.toContain("12.3");
    expect(body).not.toContain("37.23");
    expect(body).not.toContain("-121.96");
  });

  it.each([
    ["a missing longitude", { lat: 37 }],
    ["an out-of-range latitude", { lat: 200, lng: 0 }],
    ["a body that is not JSON", "not json at all"],
  ])("refuses %s with a 400 rather than an empty answer", async (_name, body) => {
    rpcMock.mockResolvedValue([]);

    const response = await post(body);

    expect(response.status).toBe(400);
    // An empty map of rings is a legitimate answer to a real question, so a bad
    // one must not be given it -- and the database is never asked.
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
