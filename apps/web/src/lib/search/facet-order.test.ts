import { describe, expect, it } from "vitest";

import { siteCatalog } from "@/lib/jobs/board";
import { JOBS, SITES } from "@/lib/jobs/job-summary.fixture";
import { facetOptions } from "@/lib/search/facet-counts";
import { EMPTY_QUERY, type JobQuery } from "@/lib/search/job-query";

// Which ORDER a facet's options come back in. Split from facet-labels.test.ts,
// which pins what an option is called; this pins where it sits, and the two are
// different failures -- an option can be named right and ranked wrong.

const catalog = siteCatalog(SITES);
const options = (query: JobQuery, key: Parameters<typeof facetOptions>[2]) =>
  facetOptions(JOBS, query, key, catalog);

/**
 * THE ONE FACET THAT IS NOT SORTED BY COUNT.
 *
 * The fixture is built so the two orders disagree outright: senior, staff and
 * manager each hold exactly one posting, so count-descending falls through to
 * the label and produces "Manager, Senior, Staff and principal". The ladder says
 * senior, staff, manager. Nothing here can pass by accident.
 */
describe("the order options come back in", () => {
  it("puts seniority in ladder order, not count order", () => {
    expect(options(EMPTY_QUERY, "seniority").map((o) => o.value)).toEqual([
      "senior",
      "staff",
      "manager",
    ]);
  });

  // A rung the board has none of still has to sort where it belongs, or the
  // order would depend on which levels happen to be hiring today.
  it("ranks a rung the board is not currently hiring at", () => {
    const values = facetOptions(
      JOBS,
      { ...EMPTY_QUERY, seniority: ["entry"] },
      "seniority",
      catalog,
    ).map((o) => o.value);

    expect(values).toEqual(["entry", "senior", "staff", "manager"]);
  });

  // Same answer the label gets: a hand-typed level is still a box that has to be
  // untickable, so it sorts after every real rung rather than being dropped.
  it("sorts a level the ladder does not hold after every rung", () => {
    const values = facetOptions(
      JOBS,
      { ...EMPTY_QUERY, seniority: ["archmage"] },
      "seniority",
      catalog,
    ).map((o) => o.value);

    expect(values).toEqual(["senior", "staff", "manager", "archmage"]);
  });

  // Nominal facets have no ladder to restore, so they keep the count order.
  // Regression against a rank comparator that leaked past its one facet.
  it("leaves every nominal facet on count-descending", () => {
    expect(options(EMPTY_QUERY, "team").map((o) => o.label)).toEqual([
      "Engineering",
      "Marketing",
    ]);
    expect(options(EMPTY_QUERY, "country").map((o) => o.label)).toEqual([
      "United States",
      "Japan",
    ]);
    expect(options(EMPTY_QUERY, "workType").map((o) => o.label)).toEqual([
      "Onsite",
      "Remote",
    ]);
    expect(options(EMPTY_QUERY, "businessUnit").map((o) => o.label)).toEqual([
      "Streaming",
      "Animation",
    ]);
  });
});
