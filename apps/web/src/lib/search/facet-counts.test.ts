import { describe, expect, it } from "vitest";

import { siteCatalog } from "@/lib/jobs/board";
import { JOBS, SITES, summary } from "@/lib/jobs/job-summary.fixture";
import { facetOptions } from "@/lib/search/facet-counts";
import { toggleCountry } from "@/lib/search/geo-query";
import { EMPTY_QUERY, type JobQuery } from "@/lib/search/job-query";
import { toggleFacet } from "@/lib/search/query-edits";

// The numbers, and only the numbers. What each option is CALLED, which country
// it nests under and what order the list arrives in are facet-labels.test.ts.

const catalog = siteCatalog(SITES);
const counts = (options: { value: string; count: number }[]) =>
  Object.fromEntries(options.map((option) => [option.value, option.count]));
const options = (query: JobQuery, key: Parameters<typeof facetOptions>[2]) =>
  facetOptions(JOBS, query, key, catalog);

describe("facetOptions", () => {
  it("counts every value in the facet when nothing is selected", () => {
    expect(counts(options(EMPTY_QUERY, "team"))).toEqual({
      Engineering: 3,
      Marketing: 2,
    });
    expect(counts(options(EMPTY_QUERY, "workType"))).toEqual({
      Onsite: 3,
      Remote: 2,
    });
  });

  // A posting open in several offices counts once against each of them, so the
  // site counts sum to more than the number of jobs. That is correct.
  it("counts a multi-site job under each of its offices", () => {
    expect(counts(options(EMPTY_QUERY, "site"))).toEqual({
      "us-los-gatos": 2,
      "us-remote": 2,
      "jp-tokyo": 1,
      "us-new-york": 1,
    });
  });

  /**
   * The country is the level users actually ask at, and it has to answer "how
   * many roles are in the US" with the number of ROLES. The Brand designer is
   * posted in New York and as US-remote; counting it the way the site facet
   * does would make the United States say five over a board of four.
   */
  it("counts a job once per country, however many offices it has there", () => {
    expect(counts(options(EMPTY_QUERY, "country"))).toEqual({ US: 4, JP: 1 });
  });

  /**
   * The one facet whose counts do not sum to the board.
   *
   * Three of the five fixture postings state a rung; "Marketing manager" and
   * "Brand designer" state none and are counted under no option at all. That
   * gap is the honest reading of a title -- see seniority.ts -- and it must not
   * be closed here with an "Other" bucket, which would be a filter named after
   * an absence of evidence.
   */
  it("counts only the postings whose titles state a level", () => {
    expect(counts(options(EMPTY_QUERY, "seniority"))).toEqual({
      senior: 1,
      staff: 1,
      manager: 1,
    });
  });

  // The whole point of counting with the facet's own selections dropped: after
  // ticking Engineering, Marketing must still show what adding it would bring.
  it("keeps its own options countable once one is selected", () => {
    const query = toggleFacet(EMPTY_QUERY, "team", "Engineering");
    const teams = options(query, "team");

    expect(counts(teams)).toEqual({ Engineering: 3, Marketing: 2 });
    expect(teams.find((o) => o.value === "Engineering")?.selected).toBe(true);
    expect(teams.find((o) => o.value === "Marketing")?.selected).toBe(false);
  });

  // The same rule, one level down: with the United States ticked, Japan still
  // has to show what ticking it would ADD rather than a zero.
  it("keeps the other countries countable once one is ticked", () => {
    expect(counts(options(toggleCountry(EMPTY_QUERY, "US"), "country"))).toEqual({
      US: 4,
      JP: 1,
    });
  });

  // The offices, by contrast, are counted INSIDE the ticked country -- that is
  // what makes the number under United States a preview of what is on screen.
  it("counts the offices within the country that is ticked", () => {
    expect(counts(options(toggleCountry(EMPTY_QUERY, "US"), "site"))).toEqual({
      "us-los-gatos": 2,
      "us-remote": 2,
      "us-new-york": 1,
    });
  });

  // Every OTHER facet still applies, which is what makes the number a real
  // preview of the result set rather than a board-wide total.
  it("narrows a facet by the other facets' selections", () => {
    const query = toggleFacet(EMPTY_QUERY, "workType", "Remote");

    expect(counts(options(query, "team"))).toEqual({
      Engineering: 1,
      Marketing: 1,
    });
  });

  it("narrows a facet by the active keywords", () => {
    const query: JobQuery = { ...EMPTY_QUERY, keywords: ["designer"] };

    expect(counts(options(query, "team"))).toEqual({ Marketing: 1 });
  });

  // Otherwise the only control that could clear the filter would disappear and
  // the visitor would be stuck with an empty list.
  it("keeps a selected option visible at zero", () => {
    const jobs = [...JOBS, summary({ team: "Legal", work_type: "Onsite" })];
    const query = toggleFacet(
      toggleFacet(EMPTY_QUERY, "team", "Legal"),
      "workType",
      "Remote",
    );

    expect(
      facetOptions(jobs, query, "team", catalog).find((o) => o.value === "Legal"),
    ).toMatchObject({ count: 0, selected: true });
  });

  it("returns nothing for a facet no job carries a value for", () => {
    const jobs = [summary({ team: null }), summary({ team: null })];

    expect(facetOptions(jobs, EMPTY_QUERY, "team", catalog)).toEqual([]);
  });
});
