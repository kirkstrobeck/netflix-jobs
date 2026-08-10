import { describe, expect, it } from "vitest";

import { siteCatalog } from "@/lib/jobs/board";
import { JOBS, SITES, summary } from "@/lib/jobs/job-summary.fixture";
import { filterJobs } from "@/lib/search/filter-jobs";
import { EMPTY_QUERY, toggleFacet, type JobQuery } from "@/lib/search/job-query";

const catalog = siteCatalog(SITES);
const titles = (jobs: { title: string }[]) => jobs.map((job) => job.title).sort();
const filter = (query: JobQuery, ignore?: Parameters<typeof filterJobs>[3]) =>
  filterJobs(JOBS, query, catalog, ignore);

describe("filterJobs", () => {
  it("returns everything for an empty query", () => {
    expect(filter(EMPTY_QUERY)).toHaveLength(5);
  });

  // Two boxes ticked in one list is a request to widen, not to narrow to zero.
  it("ORs within one facet", () => {
    const query = toggleFacet(
      toggleFacet(EMPTY_QUERY, "team", "Engineering"),
      "team",
      "Marketing",
    );

    expect(filter(query)).toHaveLength(5);
  });

  it("ANDs across facets", () => {
    const query = toggleFacet(
      toggleFacet(EMPTY_QUERY, "team", "Engineering"),
      "workType",
      "Remote",
    );

    expect(titles(filter(query))).toEqual(["Engineering manager, playback"]);
  });

  it("ANDs the keywords, so each chip narrows", () => {
    const one: JobQuery = { ...EMPTY_QUERY, keywords: ["engineer"] };
    const two: JobQuery = { ...EMPTY_QUERY, keywords: ["engineer", "staff"] };

    expect(filter(one)).toHaveLength(3);
    expect(titles(filter(two))).toEqual(["Staff software engineer"]);
  });

  it("matches keywords case-insensitively and ignores surrounding space", () => {
    const query: JobQuery = { ...EMPTY_QUERY, keywords: ["  BRAND  "] };

    expect(titles(filter(query))).toEqual(["Brand designer"]);
  });

  it("searches the team, the work type and the job code as well as the title", () => {
    const job = summary({ title: "Analyst", team: "Legal", display_job_id: "JR9182" });
    const one = (keyword: string) =>
      filterJobs([job], { ...EMPTY_QUERY, keywords: [keyword] }, catalog);

    expect(one("legal")).toHaveLength(1);
    expect(one("onsite")).toHaveLength(1);
    expect(one("jr9182")).toHaveLength(1);
  });

  it("finds a posting by the readable name of one of its sites", () => {
    const query: JobQuery = { ...EMPTY_QUERY, keywords: ["new york"] };

    expect(titles(filter(query))).toEqual(["Brand designer"]);
  });

  it("returns nothing when a keyword matches nothing", () => {
    expect(filter({ ...EMPTY_QUERY, keywords: ["atlantis"] })).toEqual([]);
  });

  // A keyword of nothing but space matches everything, so it is dropped rather
  // than scanned: the answer is the same and the board is not walked for it.
  it("ignores a keyword that is only whitespace", () => {
    expect(filter({ ...EMPTY_QUERY, keywords: ["   "] })).toHaveLength(5);
  });

  // A row with every optional column null must still be searchable by title
  // rather than throwing on the way to building its index.
  it("still matches the title when every other field is null", () => {
    const job = summary({
      title: "Archivist",
      team: null,
      work_type: null,
      display_job_id: null,
      sites: [],
    });
    const one = (keyword: string) =>
      filterJobs([job], { ...EMPTY_QUERY, keywords: [keyword] }, catalog);

    expect(one("archivist")).toHaveLength(1);
    expect(one("engineering")).toEqual([]);
  });

  // `ignore` is what lets a facet count its own options while its selections
  // still apply to the results.
  it("can drop one facet from the test", () => {
    const query = toggleFacet(EMPTY_QUERY, "team", "Engineering");

    expect(filter(query)).toHaveLength(3);
    expect(filter(query, "team")).toHaveLength(5);
  });

  // Seniority narrows like any other flat facet, ORing within itself.
  it("filters by seniority, and ORs two rungs together", () => {
    const senior = toggleFacet(EMPTY_QUERY, "seniority", "senior");
    const both = toggleFacet(senior, "seniority", "staff");

    expect(titles(filter(senior))).toEqual(["Senior software engineer"]);
    expect(titles(filter(both))).toEqual([
      "Senior software engineer",
      "Staff software engineer",
    ]);
  });

  /**
   * The consequence of the fall-through, stated as a test because it is the one
   * thing about this facet a reader has to know.
   *
   * Two of the five fixture postings state no rung. Ticking ANY seniority
   * therefore excludes them -- not because they are junior, but because their
   * titles do not say. A filter that let them through would be answering a
   * question nobody asked; one that pretends they are entry level would be
   * worse. They come back the moment the filter is cleared.
   */
  it("excludes a posting whose title states no level", () => {
    const query = toggleFacet(EMPTY_QUERY, "seniority", "manager");

    expect(titles(filter(query))).toEqual(["Engineering manager, playback"]);
    expect(titles(filter(query, "seniority"))).toHaveLength(5);
  });

  it("still applies the other facets when one is ignored", () => {
    const query = toggleFacet(
      toggleFacet(EMPTY_QUERY, "team", "Engineering"),
      "workType",
      "Remote",
    );

    expect(titles(filter(query, "team"))).toEqual([
      "Brand designer",
      "Engineering manager, playback",
    ]);
  });
});
