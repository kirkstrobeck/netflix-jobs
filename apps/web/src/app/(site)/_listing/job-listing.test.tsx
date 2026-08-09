import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { JobListing } from "@/app/(site)/_listing/job-listing";
import Home from "@/app/(site)/page";
import { boardVersion } from "@/lib/jobs/board-payload";
import { SITES, summary } from "@/lib/jobs/job-summary.fixture";
import { listJobSummaries } from "@/lib/jobs/list-jobs";
import { listSites } from "@/lib/jobs/list-sites";
import { PAGE_SIZE } from "@/lib/search/paginate";
import type { RawSearchParams } from "@/lib/search/parse-query";

vi.mock("@/lib/jobs/list-jobs", () => ({ listJobSummaries: vi.fn() }));
vi.mock("@/lib/jobs/list-sites", () => ({ listSites: vi.fn() }));
vi.mock("@/lib/jobs/board-payload", () => ({ boardVersion: vi.fn() }));

// A static render is the first paint: no effects, so the board fetch has not
// happened and every assertion below is about what the SERVER produced.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// A request with no geography on it, which the fallback reads as a US visitor.
// Every posting below is in the United States, so the country resolves to one
// that changes nothing and these assertions stay about paging and filtering.
// What varies with the request is job-listing-country.test.tsx.
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: () => undefined }),
}));

const listMock = vi.mocked(listJobSummaries);
vi.mocked(boardVersion).mockResolvedValue("bo4rdv3rs10n");
vi.mocked(listSites).mockResolvedValue(SITES);

// 25 jobs across two teams: enough for two pages and a facet worth counting.
const BOARD = Array.from({ length: 25 }, (_, i) =>
  summary({
    title: `Role ${i}`,
    team: i < 10 ? "Engineering" : "Marketing",
    work_type: i % 2 === 0 ? "Onsite" : "Remote",
  }),
);

async function renderListing(params: RawSearchParams) {
  listMock.mockResolvedValue(BOARD);

  return renderToStaticMarkup(
    await JobListing({ searchParams: Promise.resolve(params) }),
  );
}

describe("JobListing", () => {
  it("shows the first page of twenty and the total", async () => {
    const html = await renderListing({});

    expect(html.match(/class="result"/g)).toHaveLength(20);
    expect(html).toContain("Showing 1 thru 20 of 25 roles");
  });

  it("renders the page the URL asks for", async () => {
    const html = await renderListing({ page: "2" });

    expect(html).toContain("Showing 21 thru 25 of 25 roles");
    expect(html.match(/class="result"/g)).toHaveLength(5);
  });

  it("filters from the URL, server-side", async () => {
    const html = await renderListing({ team: "Engineering" });

    expect(html).toContain("of 10 roles");
    expect(html).toContain("Role 0");
    expect(html).not.toContain("Role 20");
  });

  it("combines facets and keywords from the URL", async () => {
    const html = await renderListing({ team: "Marketing", type: "Remote" });

    // Marketing is indices 10-24; Remote is the odd ones, so 11,13,...,23 = 7.
    expect(html).toContain("of 7 roles");
  });

  // The requested page can be past the end after a filter narrows the results.
  // The listing clamps rather than 404s, and the pager has to agree.
  it("clamps a page past the end and pages from the clamped page", async () => {
    const html = await renderListing({ team: "Engineering", page: "9" });

    expect(html).toContain("Showing 1 thru 10 of 10 roles");
    expect(html).not.toContain('aria-current="page"');
  });

  it("says so when the filters match nothing", async () => {
    const html = await renderListing({ q: "atlantis" });

    expect(html).toContain("No roles match these filters");
    expect(html).toContain("No matching roles");
  });

  it("puts the count with the pagination, not above the list", async () => {
    const html = await renderListing({});

    expect(html.indexOf("Showing")).toBeGreaterThan(html.indexOf("class=\"result\""));
  });

  // Every page link is a real href even before the board lands, which is what a
  // crawler follows and what a visitor with JavaScript off clicks.
  it("links every page as a URL, not a button", async () => {
    const html = await renderListing({});

    // With the country the request resolved to on it: what the server rendered
    // is what the link has to reproduce, or page 2 is a different listing.
    expect(html).toContain('href="/?country=US&amp;page=2"');
    expect(html).not.toContain("<button class=\"pager__link\"");
  });

  // The board is 143KB and there are thousands of these URLs. It arrives from
  // /api/board once, so none of it may be in the document.
  it("sends the derived view, never the board", async () => {
    const html = await renderListing({});

    // Twenty rows on page one, and the five behind them nowhere in the document
    // -- not as markup and not as serialised props.
    expect(html.match(/Role \d+/g)).toHaveLength(PAGE_SIZE);
    expect(html).not.toContain("Role 24");
  });
});

describe("Home", () => {
  // The masthead is outside the Suspense boundary, so the h1 belongs to the
  // static shell. "Open roles" moved inside the boundary when it moved into the
  // results column, so it streams with the results it names.
  it("renders the static masthead around the streamed listing", () => {
    listMock.mockResolvedValue([]);

    const html = renderToStaticMarkup(<Home searchParams={Promise.resolve({})} />);

    expect(html).toContain("masthead__title");
    // One h1 for the whole page -- the masthead's.
    expect(html.match(/<h1/g)).toHaveLength(1);
  });

  // Both columns' headers are their column's first child, which is what puts
  // them on one grid row and lines the two labels up across the page.
  it("heads the results column with the h2, inside the column itself", async () => {
    const html = await renderListing({});

    expect(html).toContain(
      '<main class="listing__results"><header class="listing-hero">' +
        '<h2 class="listing-title">Open roles</h2></header>',
    );
    expect(html.indexOf("listing-hero")).toBeLessThan(html.indexOf("facets__head"));
  });

  it("nests each result as an h3 under the listing's h2", async () => {
    const html = await renderListing({});

    expect(html).toContain('<h3 class="result__title">');
    expect(html).not.toContain('<h2 class="result__title">');
  });
});
