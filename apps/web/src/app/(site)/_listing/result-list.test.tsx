import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { FacetsPanel } from "@/app/(site)/_listing/facets-panel";
import { ListingSkeleton } from "@/app/(site)/_listing/listing-skeleton";
import { ResultList } from "@/app/(site)/_listing/result-list";
import { NavigateProvider } from "@/app/(site)/_listing/use-query-navigation";
import { BOARD, summary } from "@/lib/jobs/job-summary.fixture";
import { EMPTY_QUERY, toggleFacet, type JobQuery } from "@/lib/search/job-query";
import { deriveListing } from "@/lib/search/listing-view";
import { PAGE_SIZE } from "@/lib/search/paginate";

// The panel is fed the options deriveListing already counted, which is exactly
// what the real tree hands it -- server render and client render alike.
const panel = (query: JobQuery) =>
  renderToStaticMarkup(
    <NavigateProvider value={vi.fn()}>
      <FacetsPanel
        draft=""
        facets={deriveListing(BOARD, query).facets}
        onDraft={vi.fn()}
        query={query}
      />
    </NavigateProvider>,
  );

describe("ResultList", () => {
  it("renders one linked row per job", () => {
    const html = renderToStaticMarkup(<ResultList jobs={BOARD} />);

    expect(html.match(/class="result"/g)).toHaveLength(5);
    expect(html).toContain('href="/jobs/JR2"');
    expect(html).toContain("Senior software engineer");
  });

  // A result is a list of facts, not a table row: no <table>, and the labels are
  // per-row captions rather than a header row.
  it("is a list, not a table", () => {
    const html = renderToStaticMarkup(<ResultList jobs={BOARD} />);

    expect(html).toContain("<ol");
    expect(html).not.toContain("<table");
    expect(html).not.toContain("<th");
  });

  it("shows the facts each row aligns on", () => {
    const html = renderToStaticMarkup(<ResultList jobs={[summary()]} />);

    expect(html).toContain("Team");
    expect(html).toContain("Location");
    expect(html).toContain("Work type");
    expect(html).toContain("Posted");
  });

  it("joins several locations rather than dropping any", () => {
    const job = summary({
      locations: ["Tokyo,Japan", "Seoul,Korea, Republic of"],
    });

    expect(renderToStaticMarkup(<ResultList jobs={[job]} />)).toContain(
      "Tokyo, Japan · Seoul, Korea, Republic of",
    );
  });

  it("falls back to the scalar location when the array is empty", () => {
    const job = summary({ locations: [], location: "Tokyo,Japan" });

    expect(renderToStaticMarkup(<ResultList jobs={[job]} />)).toContain("Tokyo, Japan");
  });

  it("names the missing values instead of leaving blanks", () => {
    const job = summary({
      team: null,
      work_type: null,
      posting_date: null,
      locations: [],
      location: "",
    });
    const html = renderToStaticMarkup(<ResultList jobs={[job]} />);

    expect(html).toContain("To be confirmed");
    expect(html.match(/Not listed/g)?.length).toBe(3);
  });

  // The posted date is the detail page's component, so relative time, the
  // absolute date in the title, and the New badge all come with it.
  it("reuses the posted-date treatment, with the absolute date in the title", () => {
    const html = renderToStaticMarkup(
      <ResultList jobs={[summary({ posting_date: "2026-01-15" })]} />,
    );

    expect(html).toContain('title="January 15, 2026"');
    // Attribute case varies with the renderer; the value is what matters.
    expect(html.toLowerCase()).toContain('datetime="2026-01-15"');
  });

  it("says so when there is nothing to show", () => {
    const html = renderToStaticMarkup(<ResultList jobs={[]} />);

    expect(html).toContain("No roles match these filters");
    expect(html).not.toContain("<ol");
  });
});

describe("FacetsPanel", () => {
  it("renders the four facets with their counts", () => {
    const html = panel(EMPTY_QUERY);

    expect(html).toContain("Keywords");
    expect(html).toContain("Team");
    expect(html).toContain("Work type");
    expect(html).toContain("Location");
    expect(html).toContain("Engineering");
  });

  // Nothing to clear, no control offering to clear it.
  it("offers Clear all only once something is filtering", () => {
    const clean = panel(EMPTY_QUERY);
    const filtered = panel(toggleFacet(EMPTY_QUERY, "team", "Engineering"));

    expect(clean).not.toContain("Clear all");
    expect(filtered).toContain("Clear all");
  });

  it("points Clear all at the unfiltered listing", () => {
    const html = panel({
      ...EMPTY_QUERY,
      team: ["Engineering"],
      keywords: ["design"],
      page: 4,
    });

    expect(html).toContain('href="/"');
  });
});

describe("ListingSkeleton", () => {
  // A placeholder announcing ten empty rows is worse than silence.
  it("is a full page of rows and is hidden from assistive tech", () => {
    const html = renderToStaticMarkup(<ListingSkeleton />);

    expect(html.match(/result--ghost/g)).toHaveLength(PAGE_SIZE);
    expect(html).toContain('aria-hidden="true"');
  });
});
