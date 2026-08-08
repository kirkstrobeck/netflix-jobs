import { cacheTag } from "next/cache";
import { describe, expect, it, vi } from "vitest";

import { jobLocations } from "@/lib/jobs/job-summary";
import { summary } from "@/lib/jobs/job-summary.fixture";
import { listJobSummaries } from "@/lib/jobs/list-jobs";
import { restGet } from "@/lib/supabase/rest";

vi.mock("@/lib/supabase/rest", () => ({ restGet: vi.fn() }));

const restGetMock = vi.mocked(restGet);

describe("listJobSummaries", () => {
  it("returns the rows the database sent", async () => {
    const rows = [summary(), summary()];
    restGetMock.mockResolvedValue(rows);

    await expect(listJobSummaries()).resolves.toBe(rows);
  });

  it("is tagged so one revalidation flushes the board", async () => {
    restGetMock.mockResolvedValue([]);

    await listJobSummaries();

    expect(cacheTag).toHaveBeenCalledWith("jobs-board");
  });

  // The listing counts facets over the whole board, so it cannot ask for a page
  // and it must not silently take the database's default row cap.
  it("asks for active rows only, newest first, with an explicit limit", async () => {
    restGetMock.mockResolvedValue([]);

    await listJobSummaries();

    const path = restGetMock.mock.calls[0][0];
    expect(path).toContain("is_active=eq.true");
    expect(path).toContain("order=posting_date.desc.nullslast");
    expect(path).toContain("limit=2000");
  });

  // description_text is 2.8MB across the board against 145KB for everything
  // else; fetching it here would be caching twenty times the payload to search
  // a column the listing does not display.
  it("does not fetch the description columns", async () => {
    restGetMock.mockResolvedValue([]);

    await listJobSummaries();

    expect(restGetMock.mock.calls[0][0]).not.toContain("description");
  });
});

describe("jobLocations", () => {
  it("prefers the array", () => {
    expect(jobLocations(summary({ locations: ["Tokyo,Japan"] }))).toEqual([
      "Tokyo,Japan",
    ]);
  });

  it("falls back to the scalar column when the array is empty", () => {
    expect(jobLocations(summary({ locations: [], location: "Tokyo,Japan" }))).toEqual([
      "Tokyo,Japan",
    ]);
  });

  it("is empty when neither column has anything", () => {
    expect(jobLocations(summary({ locations: [], location: "" }))).toEqual([]);
  });
});
