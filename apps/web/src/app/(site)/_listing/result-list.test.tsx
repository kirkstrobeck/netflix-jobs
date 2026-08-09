import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { FacetsPanel } from "@/app/(site)/_listing/facets-panel";
import { ListingSkeleton } from "@/app/(site)/_listing/listing-skeleton";
import { ResultList } from "@/app/(site)/_listing/result-list";
import { NavigateProvider } from "@/app/(site)/_listing/use-query-navigation";
import { BOARD, JOBS, summary } from "@/lib/jobs/job-summary.fixture";
import { EMPTY_QUERY, toggleFacet, type JobQuery } from "@/lib/search/job-query";
import { deriveListing } from "@/lib/search/listing-view";
import { PAGE_SIZE } from "@/lib/search/paginate";

// Nothing was detected and nothing was remembered, which is the panel's plain
// case. What it does with a country that WAS detected belongs to the country
// facet, and is tested in country-facet.test.tsx.
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
    expect(html).toContain("Location");
    expect(html).toContain("Team");
    expect(html).toContain("Work type");
    expect(html).toContain("Engineering");
  });

  // The group asks one question -- where is the work -- at two depths. Calling
  // the whole thing Country named only the top of it and left the offices
  // underneath looking like a second facet with its heading missing.
  it("calls the country group Location", () => {
    const html = panel(EMPTY_QUERY);

    expect(html).toContain(">Location");
    expect(html).not.toContain(">Country");
  });

  // The country names the countries, not a list of the offices in them: that is
  // the whole complaint. One box for the United States, not ten for its cities.
  it("names countries rather than offices at the top level", () => {
    const html = panel(EMPTY_QUERY);

    expect(html).toContain("United States");
    expect(html).not.toContain("Los Gatos");
  });

  // Keywords, work type, location, team: the questions people arrive with, in
  // the order they arrive with them. Work type is two values and answers half
  // the location question for the roles that are remote, which is why it is
  // asked before the place rather than after it.
  it("orders the groups keywords, work type, location, team", () => {
    const html = panel(EMPTY_QUERY);
    const at = (legend: string) => html.indexOf(`>${legend}`);

    expect(at("Keywords")).toBeLessThan(at("Work type"));
    expect(at("Work type")).toBeLessThan(at("Location"));
    expect(at("Location")).toBeLessThan(at("Team"));
  });

  // Nothing to clear, no control offering to clear it.
  it("offers Clear all only once something is filtering", () => {
    const clean = panel(EMPTY_QUERY);
    const filtered = panel(toggleFacet(EMPTY_QUERY, "team", "Engineering"));

    expect(clean).not.toContain("Clear all");
    expect(filtered).toContain("Clear all");
  });

  /**
   * Clear goes to a bare `/`, and the answer it stands for is written to the
   * cookie by useCountryChoice on the same click -- which is what stops the
   * next load detecting the country back on. The href carries no `country=` at
   * all, because there is no longer a word for "everywhere" in an address.
   */
  it("clears to the bare listing and names no country", () => {
    const html = panel({
      ...EMPTY_QUERY,
      country: ["US"],
      team: ["Engineering"],
      keywords: ["design"],
      page: 4,
    });

    expect(html).toContain('href="/"');
    expect(html).not.toContain("country=all");
  });

  // Everywhere is the ABSENCE of a filter. Counting it as one would put a Clear
  // all beside a listing showing every role there is.
  it("does not call an unfiltered listing filtered", () => {
    expect(panel(EMPTY_QUERY)).not.toContain("Clear all");
  });
});

/**
 * The narrow-screen disclosure, which is markup plus CSS and no script.
 *
 * What is pinned here is the part CSS cannot recover from if it moves: the
 * checkbox has to come BEFORE the panel and be its sibling, because
 * `:checked ~ .facets__panel` only looks forward, and the label has to be bound
 * to it by id or the control has no accessible name and no keyboard.
 */
describe("the filters disclosure", () => {
  it("puts the switch before the panel it opens, as a sibling", () => {
    const html = panel(EMPTY_QUERY);
    const id = html.match(/class="facets__switch[^"]*" id="([^"]+)"/)?.[1];

    expect(id).toBeTruthy();
    expect(html).toContain(`for="${id}"`);
    expect(html.indexOf("facets__switch")).toBeLessThan(html.indexOf("facets__panel"));
  });

  // One set of controls. A second, mobile-only copy of the panel is two sets of
  // checkboxes that have to keep saying the same thing.
  it("renders the panel exactly once", () => {
    expect(panel(EMPTY_QUERY).match(/facets__panel/g)).toHaveLength(1);
  });

  // A shut drawer over an applied filter is an invisible filter, so the shut
  // drawer says how many. The word itself never changes -- open and shut is
  // what the checkbox announces -- so the accessible name stays put.
  it("says how many filters are applied, and only when some are", () => {
    const clean = panel(EMPTY_QUERY);
    const filtered = panel({
      ...EMPTY_QUERY,
      country: ["US"],
      team: ["Engineering"],
      keywords: ["design"],
    });

    expect(clean).not.toContain("facets__applied");
    expect(filtered).toContain(">3 applied<");
    expect(filtered).not.toContain("Show filters");
    expect(filtered).not.toContain("Hide filters");
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
