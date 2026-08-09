import { cacheTag } from "next/cache";
import { describe, expect, it, vi } from "vitest";

import { toSummary, type JobRow } from "@/lib/jobs/job-summary";
import { summary } from "@/lib/jobs/job-summary.fixture";
import { listJobSummaries } from "@/lib/jobs/list-jobs";
import { restGet } from "@/lib/supabase/rest";

vi.mock("@/lib/supabase/rest", () => ({ restGet: vi.fn() }));

const restGetMock = vi.mocked(restGet);

// A posting as PostgREST hands it over, with the join still nested and the
// flattened `sites` not there yet.
const row = (...slugs: string[]): JobRow => {
  const { sites, ...job } = summary();
  void sites;

  return { ...job, job_locations: slugs.map((slug) => ({ location_slug: slug })) };
};

describe("listJobSummaries", () => {
  it("flattens the join into the slugs the listing filters on", async () => {
    restGetMock.mockResolvedValue([row("us-los-gatos", "us-remote")]);

    await expect(listJobSummaries()).resolves.toEqual([
      expect.objectContaining({ sites: ["us-los-gatos", "us-remote"] }),
    ]);
  });

  it("carries no join column into the flattened row", async () => {
    restGetMock.mockResolvedValue([row("jp-tokyo")]);

    const [job] = await listJobSummaries();

    expect(job).not.toHaveProperty("job_locations");
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

  // The slugs are what makes a country answerable at all, so they have to come
  // back with the postings rather than as a second request that could be one
  // crawl out of step with the first.
  it("embeds the location join in the same request", async () => {
    restGetMock.mockResolvedValue([]);

    await listJobSummaries();

    expect(restGetMock.mock.calls[0][0]).toContain("job_locations(location_slug)");
  });
});

describe("toSummary", () => {
  // PostgREST does not promise an order for an embedded resource, and
  // boardVersion() is a digest of these exact bytes -- an unordered array would
  // bust every browser's copy of the board on a crawl that changed nothing.
  it("sorts the slugs, whatever order the join returned them in", () => {
    expect(toSummary(row("us-remote", "jp-tokyo", "us-los-gatos")).sites).toEqual([
      "jp-tokyo",
      "us-los-gatos",
      "us-remote",
    ]);
  });

  it("is an empty list for a posting with no location rows", () => {
    expect(toSummary(row()).sites).toEqual([]);
  });
});
