import { describe, expect, it } from "vitest";

import { siteCatalog } from "@/lib/jobs/board";
import { SITES, summary } from "@/lib/jobs/job-summary.fixture";
import { facetValues, keywordText } from "@/lib/search/job-index";

const catalog = siteCatalog(SITES);

describe("facetValues", () => {
  it("reads the single-valued facets as one-entry lists", () => {
    const job = summary({ team: "Legal", work_type: "Remote" });

    expect(facetValues(job, "team", catalog)).toEqual(["Legal"]);
    expect(facetValues(job, "workType", catalog)).toEqual(["Remote"]);
  });

  it("is empty where the column is null", () => {
    expect(facetValues(summary({ team: null }), "team", catalog)).toEqual([]);
    expect(facetValues(summary({ work_type: null }), "workType", catalog)).toEqual([]);
  });

  it("reads a posting's sites as slugs and its countries as codes", () => {
    const job = summary({ sites: ["jp-tokyo", "us-remote"] });

    expect(facetValues(job, "site", catalog)).toEqual(["jp-tokyo", "us-remote"]);
    expect(facetValues(job, "country", catalog)).toEqual(["JP", "US"]);
  });

  // A role open in Los Gatos AND as US-remote is one United States role. Two
  // entries here would count it twice in the country facet.
  it("counts a country once however many of its sites a posting names", () => {
    const job = summary({ sites: ["us-los-gatos", "us-new-york", "us-remote"] });

    expect(facetValues(job, "country", catalog)).toEqual(["US"]);
  });

  // Impossible from the database -- job_locations.location_slug is a foreign
  // key -- so this is only about which failure a mispaired board produces.
  it("drops a slug that has no row in the catalog", () => {
    const job = summary({ sites: ["jp-tokyo", "xx-atlantis"] });

    expect(facetValues(job, "site", catalog)).toEqual(["jp-tokyo"]);
    expect(facetValues(job, "country", catalog)).toEqual(["JP"]);
  });

  it("is empty for a posting with no sites at all", () => {
    expect(facetValues(summary({ sites: [] }), "country", catalog)).toEqual([]);
  });
});

describe("keywordText", () => {
  it("joins everything a keyword may match, lowercased", () => {
    const text = keywordText(
      summary({ title: "Analyst", team: "Legal", display_job_id: "JR9182" }),
      catalog,
    );

    expect(text).toContain("analyst");
    expect(text).toContain("legal");
    expect(text).toContain("jr9182");
  });

  // The site's display name carries city, region and country in one string, so
  // all three are typeable without being indexed separately.
  it("indexes a site by every part of its display name", () => {
    const text = keywordText(summary({ sites: ["us-los-gatos"] }), catalog);

    expect(text).toContain("los gatos");
    expect(text).toContain("california");
    expect(text).toContain("united states");
  });

  it("survives a row whose every optional column is null", () => {
    const job = summary({
      title: "Archivist",
      team: null,
      work_type: null,
      display_job_id: null,
      sites: [],
    });

    expect(keywordText(job, catalog).trim()).toBe("archivist");
  });
});

// Being built once is the behaviour under test, not an implementation detail:
// it is the whole reason a keystroke is cheap. The second read has to be the
// very same array, or every pass is rebuilding what it already had.
describe("memoisation", () => {
  it("hands back the same index for the same row", () => {
    const job = summary();

    expect(facetValues(job, "site", catalog)).toBe(facetValues(job, "site", catalog));
    expect(keywordText(job, catalog)).toBe(keywordText(job, catalog));
  });

  it("indexes two rows separately", () => {
    expect(keywordText(summary({ title: "One" }), catalog)).not.toBe(
      keywordText(summary({ title: "Two" }), catalog),
    );
  });
});
