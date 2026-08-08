import { cacheTag } from "next/cache";
import { describe, expect, it, vi } from "vitest";

import { listRecentJobIds } from "@/lib/jobs/job-ids";
import { restGet } from "@/lib/supabase/rest";

vi.mock("@/lib/supabase/rest", () => ({
  restGet: vi.fn(),
}));

const restGetMock = vi.mocked(restGet);

describe("listRecentJobIds", () => {
  it("filters out null display_job_id values", async () => {
    restGetMock.mockResolvedValue([
      { display_job_id: "JR41912" },
      { display_job_id: null },
      { display_job_id: "AJRT30201" },
    ]);

    await expect(listRecentJobIds()).resolves.toEqual(["JR41912", "AJRT30201"]);
  });

  it("returns an array of strings", async () => {
    restGetMock.mockResolvedValue([{ display_job_id: "JR41912" }]);

    const result = await listRecentJobIds();

    expect(result).toEqual(["JR41912"]);
    expect(typeof result[0]).toBe("string");
  });

  // The sample is derived from the board, so the crawl that flushes the listing
  // has to flush this too -- otherwise generateStaticParams keeps prerendering
  // ids from the previous crawl.
  it("carries the board tag", async () => {
    restGetMock.mockResolvedValue([]);

    await listRecentJobIds();

    expect(cacheTag).toHaveBeenCalledWith("jobs-board");
  });
});
