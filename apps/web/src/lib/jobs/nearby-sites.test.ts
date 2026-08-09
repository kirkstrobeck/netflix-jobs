import { describe, expect, it, vi } from "vitest";

import { nearbySites } from "@/lib/jobs/nearby-sites";
import { restRpc } from "@/lib/supabase/rpc";

vi.mock("@/lib/supabase/rpc", () => ({ restRpc: vi.fn() }));

const rpcMock = vi.mocked(restRpc);

describe("nearbySites", () => {
  it("turns kilometres into metro rings", async () => {
    rpcMock.mockResolvedValue([
      { slug: "us-los-gatos", distance_km: 0 },
      { slug: "us-los-angeles", distance_km: 488 },
      { slug: "jp-tokyo", distance_km: 8300.4 },
    ]);

    await expect(nearbySites({ lat: 37.23, lng: -121.96 })).resolves.toEqual({
      "us-los-gatos": 0,
      "us-los-angeles": 9,
      "jp-tokyo": 166,
    });
  });

  // The invariant the whole feature rests on: a site with no coordinates is not
  // in the answer at all, so there is no number to misread as zero.
  it("has no entry for a site the database did not place", async () => {
    rpcMock.mockResolvedValue([{ slug: "us-los-gatos", distance_km: 0 }]);

    const buckets = await nearbySites({ lat: 37.23, lng: -121.96 });

    expect(buckets["us-remote"]).toBeUndefined();
    expect(Object.keys(buckets)).toEqual(["us-los-gatos"]);
  });

  // Belt and braces against a row that should not exist. A NaN would otherwise
  // be written under a real slug, which reads downstream as "this office has no
  // coordinates" -- a lie about an office that has them.
  it("drops a row whose distance is not a number", async () => {
    rpcMock.mockResolvedValue([
      { slug: "us-los-gatos", distance_km: Number.NaN },
      { slug: "us-new-york", distance_km: 4130 },
    ]);

    await expect(nearbySites({ lat: 37.23, lng: -121.96 })).resolves.toEqual({
      "us-new-york": 82,
    });
  });
});
