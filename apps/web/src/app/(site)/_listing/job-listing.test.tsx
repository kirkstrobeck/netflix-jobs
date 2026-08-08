import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { JobListing } from "@/app/(site)/_listing/job-listing";
import Home from "@/app/(site)/page";
import { summary } from "@/lib/jobs/job-summary.fixture";
import { listJobSummaries } from "@/lib/jobs/list-jobs";
import type { RawSearchParams } from "@/lib/search/job-query";

vi.mock("@/lib/jobs/list-jobs", () => ({ listJobSummaries: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: React.ReactNode }) => (
    <a {...props}>{children}</a>
  ),
}));

const listMock = vi.mocked(listJobSummaries);

// 25 jobs across two teams: enough for three pages and a facet worth counting.
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
  it("shows the first page of ten and the total", async () => {
    const html = await renderListing({});

    expect(html.match(/class="result"/g)).toHaveLength(10);
    expect(html).toContain("<strong>25</strong>");
  });

  it("renders the page the URL asks for", async () => {
    const html = await renderListing({ page: "3" });

    expect(html).toContain("<strong>21</strong>");
    expect(html).toContain("<strong>25</strong>");
    expect(html.match(/class="result"/g)).toHaveLength(5);
  });

  it("filters from the URL, server-side", async () => {
    const html = await renderListing({ team: "Engineering" });

    expect(html).toContain("<strong>10</strong>");
    expect(html).toContain("Role 0");
    expect(html).not.toContain("Role 20");
  });

  it("combines facets and keywords from the URL", async () => {
    const html = await renderListing({ team: "Marketing", type: "Remote" });

    // Marketing is indices 10-24; Remote is the odd ones, so 11,13,...,23 = 7.
    expect(html).toContain("<strong>7</strong>");
  });

  // The requested page can be past the end after a filter narrows the results.
  // The listing clamps rather than 404s, and the pager has to agree.
  it("clamps a page past the end and pages from the clamped page", async () => {
    const html = await renderListing({ team: "Engineering", page: "9" });

    expect(html).toContain("<strong>1</strong> to <strong>10</strong>");
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
});

describe("Home", () => {
  // The heading is outside the Suspense boundary, so it belongs to the static
  // shell and renders without ever awaiting searchParams.
  it("renders the static heading around the streamed listing", () => {
    listMock.mockResolvedValue([]);

    const html = renderToStaticMarkup(
      <Home searchParams={Promise.resolve({})} />,
    );

    expect(html).toContain("Open roles");
    expect(html).toContain("listing-hero");
    // One h1 for the whole page -- the masthead's. "Open roles" is the h2 under
    // it, and each result is an h3 under that.
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('<h2 class="listing-title">Open roles</h2>');
  });

  it("nests each result as an h3 under the listing's h2", async () => {
    listMock.mockResolvedValue(BOARD);

    const html = renderToStaticMarkup(
      await JobListing({ searchParams: Promise.resolve({}) }),
    );

    expect(html).toContain('<h3 class="result__title">');
    expect(html).not.toContain('<h2 class="result__title">');
  });
});
