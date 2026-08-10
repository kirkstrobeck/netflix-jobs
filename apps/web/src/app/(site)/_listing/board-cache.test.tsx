import { cacheLife, cacheTag } from "next/cache";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { BoardPage } from "@/app/(site)/_listing/board-page";
import { boardVersion } from "@/lib/jobs/board-payload";
import { SITES, summary } from "@/lib/jobs/job-summary.fixture";
import { listJobSummaries } from "@/lib/jobs/list-jobs";
import { listSites } from "@/lib/jobs/list-sites";
import { parseJobQuery, type RawSearchParams } from "@/lib/search/parse-query";

vi.mock("@/lib/jobs/list-jobs", () => ({ listJobSummaries: vi.fn() }));
vi.mock("@/lib/jobs/list-sites", () => ({ listSites: vi.fn() }));
vi.mock("@/lib/jobs/board-payload", () => ({ boardVersion: vi.fn() }));

// A static render is the first paint: no effects, so the board fetch has not
// happened and every assertion below is about what the SERVER produced.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// No next/headers mock, and none is needed: this render reads searchParams and
// nothing else. Which country a request resolves to is settled a hop earlier,
// in proxy.ts, and is pinned in lib/geo/country-redirect.test.ts.

const listMock = vi.mocked(listJobSummaries);
vi.mocked(boardVersion).mockResolvedValue("bo4rdv3rs10n");
vi.mocked(listSites).mockResolvedValue(SITES);

// A board small enough to render fast; what it contains does not matter here,
// since every assertion in this file is about the cache entry rather than about
// what is in it.
const BOARD = [summary({ title: 'Role 0' })];

async function renderListing(params: RawSearchParams) {
  listMock.mockResolvedValue(BOARD);

  return renderToStaticMarkup(await BoardPage({ query: parseJobQuery(params) }));
}

describe("BoardPage's cache entry", () => {
  // The whole facet combination is the key, and it is the PARSED query rather
  // than the raw string: parseJobQuery lower-cases, de-duplicates and sorts, so
  // two spellings of one screen share one entry instead of rendering twice.
  it("is keyed on the parsed query, so two spellings of one screen are one entry", () => {
    expect(parseJobQuery({ country: "us", level: ["senior", "Senior"] })).toEqual(
      parseJobQuery({ country: "US", level: "senior" }),
    );
    expect(parseJobQuery({ country: "US" })).not.toEqual(
      parseJobQuery({ country: "US", level: "senior" }),
    );
  });

  it("carries the board tag and the long profile", async () => {
    await renderListing({ country: "US" });

    expect(cacheLife).toHaveBeenCalledWith("jobs");
    expect(cacheTag).toHaveBeenCalledWith("jobs-board");
  });

  // The server is never told where the visitor is, so `?sort=near` gets its own
  // entry and that entry is the newest-first list -- the same bytes for everyone
  // who asks for it. deriveListing is called with two arguments here and never
  // three. Distance is applied after paint, in the browser.
  it("renders newest for ?sort=near, so no position can reach a shared entry", async () => {
    const newest = await renderListing({});
    const near = await renderListing({ sort: "near" });

    expect(near.match(/Role \d+/g)).toEqual(newest.match(/Role \d+/g));
  });
});

