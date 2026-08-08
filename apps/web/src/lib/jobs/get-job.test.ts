import { cacheTag } from "next/cache";
import { describe, expect, it, vi } from "vitest";

import { getJob } from "@/lib/jobs/get-job";
import { restGet } from "@/lib/supabase/rest";
import type { Job } from "@/lib/jobs/types";

vi.mock("@/lib/supabase/rest", () => ({
  restGet: vi.fn(),
}));

const restGetMock = vi.mocked(restGet);

describe("getJob", () => {
  it("returns null without fetching when the id is not job-id shaped", async () => {
    await expect(getJob("hello")).resolves.toBeNull();
    expect(restGetMock).not.toHaveBeenCalled();
  });

  it("returns null when no rows come back", async () => {
    restGetMock.mockResolvedValue([]);

    await expect(getJob("JR41912")).resolves.toBeNull();
  });

  it("returns the first row", async () => {
    const job = { position_id: 1, display_job_id: "JR41912" } as Job;
    restGetMock.mockResolvedValue([job]);

    await expect(getJob("JR41912")).resolves.toBe(job);
  });

  it("encodes the id into the rpc request path", async () => {
    restGetMock.mockResolvedValue([]);

    await getJob("JR41912");

    expect(restGetMock).toHaveBeenCalledWith(
      expect.stringContaining(`rpc/job_by_display_id?p_display_id=${encodeURIComponent("JR41912")}`),
    );
  });

  it("tags the cache entry with the uppercased id", async () => {
    restGetMock.mockResolvedValue([]);

    await getJob("jr41912");

    expect(cacheTag).toHaveBeenCalledWith("jobs-board", "job:JR41912");
  });
});
