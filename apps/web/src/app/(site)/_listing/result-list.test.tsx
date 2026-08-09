import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { FacetsPanel } from "@/app/(site)/_listing/facets-panel";
import { ListingSkeleton } from "@/app/(site)/_listing/listing-skeleton";
import { ResultList } from "@/app/(site)/_listing/result-list";
import { NavigateProvider } from "@/app/(site)/_listing/use-query-navigation";
import { BOARD, JOBS, summary } from "@/lib/jobs/job-summary.fixture";
import { everyCountry, type CountryDefault } from "@/lib/search/geo-query";
import { EMPTY_QUERY, toggleFacet, type JobQuery } from "@/lib/search/job-query";
import { deriveListing } from "@/lib/search/listing-view";
import { PAGE_SIZE } from "@/lib/search/paginate";

// Nothing was detected and nothing was remembered, which is the panel's plain
// case. What it does with a country that WAS detected belongs to the country
// facet, and is tested in country-facet.test.tsx.
const NO_DEFAULT: CountryDefault = { countries: [], from: "detected" };

// The panel is fed the options deriveListing already counted, which is exactly
// what the real tree hands it -- server render and client render alike.
const panel = (query: JobQuery, countryDefault: CountryDefault = NO_DEFAULT) =>
  renderToStaticMarkup(
    <NavigateProvider value={vi.fn()}>
      <FacetsPanel
        countryDefault={countryDefault}
        draft=""
        facets={deriveListing(BOARD, query).facets}
        onDraft={vi.fn()}
        query={query}
      />
    </NavigateProvider>,
  );

describe("ResultList", () => {
  it("renders one linked row per job", () => {
    const html = renderToStaticMarkup(<ResultList jobs={JOBS} />);

    expect(html.match(/class="result"/g)).toHaveLength(5);
    expect(html).toContain('href="/jobs/JR2"');
    expect(html).toContain("Senior software engineer");
  });

  // A result is a list of facts, not a table row: no <table>, and the labels are
  // per-row captions rather than a header row.
  it("is a list, not a table", () => {
    const html = renderToStaticMarkup(<ResultList jobs={JOBS} />);

    expect(html).toContain("<ol");
    expect(html).not.toContain("<table");
    expect(html).not.toContain("<th");
  });

  // The row is the title and how old the posting is, and nothing else: team,
  // location and work type are all filters in the panel beside the list, so
  // repeating them down every row answered a question the visitor had just
  // answered themselves.
  it("carries the title and the posted date, and no other facts", () => {
    const html = renderToStaticMarkup(
      <ResultList jobs={[summary({ title: "Staff designer" })]} />,
    );

    expect(html).toContain("Staff designer");
    expect(html).toContain("Posted");
    expect(html).not.toContain("Team");
    expect(html).not.toContain("Work type");
    expect(html).not.toContain("Los Gatos");
  });

  // Hidden, not dropped: "3 days ago" on its own does not say posted, and the
  // <dt> is what makes it a named value rather than a loose date.
  it("keeps the date's name for a screen reader, off screen", () => {
    const html = renderToStaticMarkup(<ResultList jobs={[summary()]} />);

    expect(html).toContain('<dt class="visually-hidden">Posted</dt>');
  });

  it("names a missing date instead of leaving a blank", () => {
    const html = renderToStaticMarkup(
      <ResultList jobs={[summary({ posting_date: null })]} />,
    );

    expect(html.match(/Not listed/g)?.length).toBe(1);
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
    expect(html).toContain("Country");
    expect(html).toContain("Team");
    expect(html).toContain("Work type");
    expect(html).toContain("Engineering");
  });

  // The country names the countries, not a list of the offices in them: that is
  // the whole complaint. One box for the United States, not ten for its cities.
  it("names countries rather than offices at the top level", () => {
    const html = panel(EMPTY_QUERY);

    expect(html).toContain("United States");
    expect(html).not.toContain("Los Gatos");
  });

  // A country can arrive ALREADY TICKED, matched to the request, so a filter
  // that applied itself has to be the first group rather than the third.
  it("puts country above work type and team", () => {
    const html = panel(EMPTY_QUERY);

    expect(html.indexOf("Country")).toBeLessThan(html.indexOf("Work type"));
    expect(html.indexOf("Work type")).toBeLessThan(html.indexOf("Team"));
  });

  // Nothing to clear, no control offering to clear it.
  it("offers Clear all only once something is filtering", () => {
    const clean = panel(EMPTY_QUERY);
    const filtered = panel(toggleFacet(EMPTY_QUERY, "team", "Engineering"));

    expect(clean).not.toContain("Clear all");
    expect(filtered).toContain("Clear all");
  });

  /**
   * Clear goes to `?country=all`, not to `/`.
   *
   * A bare `/` leaves the country question unanswered, which is the one state
   * that invites detection to answer it -- so the next load would put the
   * visitor's own country straight back on and the button would look like it
   * had not worked.
   */
  it("clears to every country, explicitly, rather than to a bare listing", () => {
    const html = panel({
      ...EMPTY_QUERY,
      country: ["US"],
      team: ["Engineering"],
      keywords: ["design"],
      page: 4,
    });

    expect(html).toContain('href="/?country=all"');
    expect(html).not.toContain('href="/"');
  });

  // `everywhere` is the ABSENCE of a country filter, said out loud. Counting it
  // as a filter would put a Clear all beside a listing showing every role.
  it("does not call an explicit everywhere a filter", () => {
    expect(panel(everyCountry(EMPTY_QUERY))).not.toContain("Clear all");
  });
});

describe("ListingSkeleton", () => {
  // A placeholder announcing a page of empty rows is worse than silence.
  it("is a full page of rows and is hidden from assistive tech", () => {
    const html = renderToStaticMarkup(<ListingSkeleton />);

    expect(html.match(/result--ghost/g)).toHaveLength(PAGE_SIZE);
    expect(html).toContain('aria-hidden="true"');
  });
});
