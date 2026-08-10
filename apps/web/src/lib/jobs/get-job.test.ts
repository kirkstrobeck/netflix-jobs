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
    const row = { position_id: 1, display_job_id: "JR41912", job_locations: [] };
    restGetMock.mockResolvedValue([row]);

    await expect(getJob("JR41912")).resolves.toEqual({
      position_id: 1,
      display_job_id: "JR41912",
      sites: [],
    } as unknown as Job);
  });

  // The embedded join is flattened on the way out, and sorted: PostgREST does
  // not promise an order for an embedded resource, and a page whose location
  // links reorder between crawls is a page that looks like it changed.
  it("flattens the embedded locations into sorted slugs", async () => {
    restGetMock.mockResolvedValue([
      {
        position_id: 1,
        display_job_id: "JR41912",
        job_locations: [{ location_slug: "us-remote" }, { location_slug: "jp-tokyo" }],
      },
    ]);

    const job = await getJob("JR41912");

    expect(job?.sites).toEqual(["jp-tokyo", "us-remote"]);
    expect(job).not.toHaveProperty("job_locations");
  });

  it("asks for the locations join", async () => {
    restGetMock.mockResolvedValue([]);

    await getJob("JR41912");

    expect(restGetMock).toHaveBeenCalledWith(
      expect.stringContaining("job_locations(location_slug)"),
    );
  });

  it("encodes the id into the rpc request path", async () => {
    restGetMock.mockResolvedValue([]);

    await getJob("JR41912");

    expect(restGetMock).toHaveBeenCalledWith(
      expect.stringContaining(`rpc/job_by_display_id?p_display_id=${encodeURIComponent("JR41912")}`),
    );
  });

  // One tag, and it names this posting only. The board tag used to be here too,
  // so that "the crawl ran" flushed all 481 job pages at once; the ingestor now
  // names the roles whose content actually moved, and keeping the blunt tag
  // would put every posting inside the blast radius of one added role.
  it("tags the cache entry with the uppercased id, and with nothing else", async () => {
    restGetMock.mockResolvedValue([]);

    await getJob("jr41912");

    expect(cacheTag).toHaveBeenCalledWith("job:JR41912");
    expect(cacheTag).not.toHaveBeenCalledWith(expect.stringContaining("jobs-board"));
  });
});
