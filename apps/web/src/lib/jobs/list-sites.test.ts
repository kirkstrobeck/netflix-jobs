import { cacheTag } from "next/cache";
import { describe, expect, it, vi } from "vitest";

import { SITES } from "@/lib/jobs/job-summary.fixture";
import { listSites } from "@/lib/jobs/list-sites";
import { restGet } from "@/lib/supabase/rest";

vi.mock("@/lib/supabase/rest", () => ({ restGet: vi.fn() }));

const restGetMock = vi.mocked(restGet);

describe("listSites", () => {
  it("returns the site table the database sent", async () => {
    restGetMock.mockResolvedValue(SITES);

    await expect(listSites()).resolves.toBe(SITES);
  });

  // No filter and no join to the postings: 36 rows is smaller than the query
  // that would narrow it, and a site with nothing open today is one crawl away
  // from having something. What decides whether a country appears in the facet
  // is the count over the board, not the presence of a row here.
  it("asks for the whole table, unfiltered", async () => {
    restGetMock.mockResolvedValue([]);

    await listSites();

    const path = restGetMock.mock.calls[0][0];
    expect(path).toContain("locations?select=");
    expect(path).not.toContain("is_remote=");
    expect(path).not.toContain("limit=");
  });

  // The country code and the display name are what the facet is built out of,
  // so a column dropped here empties a group rather than degrading it.
  it("fetches every column the facet labels itself from", async () => {
    restGetMock.mockResolvedValue([]);

    await listSites();

    const path = restGetMock.mock.calls[0][0];
    ["slug", "city", "region", "country_code", "country", "display_name"].forEach(
      (column) => expect(path).toContain(column),
    );
  });

  // Same tag as the board it describes, so one POST /api/revalidate flushes
  // both and the two can never be a crawl apart.
  it("is tagged with the board, not with a table of its own", async () => {
    restGetMock.mockResolvedValue([]);

    await listSites();

    expect(cacheTag).toHaveBeenCalledWith("jobs-board");
  });
});
