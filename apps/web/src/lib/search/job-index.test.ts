import { describe, expect, it } from "vitest";

import { summary } from "@/lib/jobs/job-summary.fixture";
import { facetValues, keywordText } from "@/lib/search/job-index";

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

describe("keywordText", () => {
  it("joins everything a keyword may match, lowercased", () => {
    const text = keywordText(
      summary({ title: "Analyst", team: "Legal", display_job_id: "JR9182" }),
    );

    expect(text).toContain("analyst");
    expect(text).toContain("legal");
    expect(text).toContain("jr9182");
  });

  // "New York" is stored as "New York,New York,United States of America", so
  // indexing only the raw string would miss the way anyone would type it.
  it("indexes the readable form of a location as well as the stored one", () => {
    const text = keywordText(summary({ locations: ["Tokyo,Japan"] }));

    expect(text).toContain("tokyo,japan");
    expect(text).toContain("tokyo, japan");
  });

  it("survives a row whose every optional column is null", () => {
    const job = summary({
      title: "Archivist",
      team: null,
      work_type: null,
      display_job_id: null,
      locations: [],
      location: "",
    });

    expect(keywordText(job).trim()).toBe("archivist");
  });
});

// Being built once is the behaviour under test, not an implementation detail:
// it is the whole reason a keystroke is cheap. The second read has to be the
// very same array, or every pass is rebuilding what it already had.
describe("memoisation", () => {
  it("hands back the same index for the same row", () => {
    const job = summary();

    expect(facetValues(job, "location")).toBe(facetValues(job, "location"));
    expect(keywordText(job)).toBe(keywordText(job));
  });

  it("indexes two rows separately", () => {
    expect(keywordText(summary({ title: "One" }))).not.toBe(
      keywordText(summary({ title: "Two" })),
    );
  });
});
