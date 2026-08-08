import { describe, expect, it } from "vitest";

import { BOARD, summary } from "@/lib/jobs/job-summary.fixture";
import { facetValues, filterJobs, matchesQuery } from "@/lib/search/filter-jobs";
import { EMPTY_QUERY, toggleFacet, type JobQuery } from "@/lib/search/job-query";

const titles = (jobs: { title: string }[]) => jobs.map((job) => job.title).sort();

describe("facetValues", () => {
  it("reads the single-valued facets as one-entry lists", () => {
    const job = summary({ team: "Legal", work_type: "Remote" });

    expect(facetValues(job, "team")).toEqual(["Legal"]);
    expect(facetValues(job, "workType")).toEqual(["Remote"]);
  });

  it("is empty where the column is null", () => {
    expect(facetValues(summary({ team: null }), "team")).toEqual([]);
    expect(facetValues(summary({ work_type: null }), "workType")).toEqual([]);
  });

  // locations is NOT NULL with a '{}' default, so the scalar column is the
  // fallback rather than a second source of truth.
  it("falls back to the scalar location when the array is empty", () => {
    const job = summary({ locations: [], location: "Tokyo,Japan" });

    expect(facetValues(job, "location")).toEqual(["Tokyo,Japan"]);
  });

  it("is empty when neither location column has anything", () => {
    expect(facetValues(summary({ locations: [], location: "" }), "location")).toEqual([]);
  });
});

describe("filterJobs", () => {
  it("returns everything for an empty query", () => {
    expect(filterJobs(BOARD, EMPTY_QUERY)).toHaveLength(5);
  });

  // Two boxes ticked in one list is a request to widen, not to narrow to zero.
  it("ORs within one facet", () => {
    const query = toggleFacet(
      toggleFacet(EMPTY_QUERY, "team", "Engineering"),
      "team",
      "Marketing",
    );

    expect(filterJobs(BOARD, query)).toHaveLength(5);
  });

  it("ANDs across facets", () => {
    const query = toggleFacet(
      toggleFacet(EMPTY_QUERY, "team", "Engineering"),
      "workType",
      "Remote",
    );

    expect(titles(filterJobs(BOARD, query))).toEqual(["Engineering manager, playback"]);
  });

  it("matches a job on any one of its locations", () => {
    const query = toggleFacet(EMPTY_QUERY, "location", "USA - Remote");

    expect(titles(filterJobs(BOARD, query))).toEqual([
      "Brand designer",
      "Engineering manager, playback",
    ]);
  });

  it("ANDs the keywords, so each chip narrows", () => {
    const one: JobQuery = { ...EMPTY_QUERY, keywords: ["engineer"] };
    const two: JobQuery = { ...EMPTY_QUERY, keywords: ["engineer", "staff"] };

    expect(filterJobs(BOARD, one)).toHaveLength(3);
    expect(titles(filterJobs(BOARD, two))).toEqual(["Staff software engineer"]);
  });

  it("matches keywords case-insensitively and ignores surrounding space", () => {
    const query: JobQuery = { ...EMPTY_QUERY, keywords: ["  BRAND  "] };

    expect(titles(filterJobs(BOARD, query))).toEqual(["Brand designer"]);
  });

  it("searches the team, the work type and the job code as well as the title", () => {
    const job = summary({ title: "Analyst", team: "Legal", display_job_id: "JR9182" });

    expect(matchesQuery(job, { ...EMPTY_QUERY, keywords: ["legal"] })).toBe(true);
    expect(matchesQuery(job, { ...EMPTY_QUERY, keywords: ["onsite"] })).toBe(true);
    expect(matchesQuery(job, { ...EMPTY_QUERY, keywords: ["jr9182"] })).toBe(true);
  });

  // "New York" is stored as "New York,New York,United States of America", so
  // matching only the raw string would miss the way anyone would type it.
  it("finds a location by its readable form as well as its stored one", () => {
    const query: JobQuery = { ...EMPTY_QUERY, keywords: ["York, New York"] };

    expect(titles(filterJobs(BOARD, query))).toEqual(["Brand designer"]);
  });

  it("returns nothing when a keyword matches nothing", () => {
    expect(filterJobs(BOARD, { ...EMPTY_QUERY, keywords: ["atlantis"] })).toEqual([]);
  });

  // A row with every optional column null must still be searchable by title
  // rather than throwing on the way to building its haystack.
  it("still matches the title when every other field is null", () => {
    const job = summary({
      title: "Archivist",
      team: null,
      work_type: null,
      display_job_id: null,
      locations: [],
      location: "",
    });

    expect(matchesQuery(job, { ...EMPTY_QUERY, keywords: ["archivist"] })).toBe(true);
    expect(matchesQuery(job, { ...EMPTY_QUERY, keywords: ["engineering"] })).toBe(false);
  });

  // `ignore` is what lets a facet count its own options while its selections
  // still apply to the results.
  it("can drop one facet from the test", () => {
    const query = toggleFacet(EMPTY_QUERY, "team", "Engineering");

    expect(filterJobs(BOARD, query)).toHaveLength(3);
    expect(filterJobs(BOARD, query, "team")).toHaveLength(5);
  });

  it("still applies the other facets when one is ignored", () => {
    const query = toggleFacet(
      toggleFacet(EMPTY_QUERY, "team", "Engineering"),
      "workType",
      "Remote",
    );

    expect(titles(filterJobs(BOARD, query, "team"))).toEqual([
      "Brand designer",
      "Engineering manager, playback",
    ]);
  });
});
