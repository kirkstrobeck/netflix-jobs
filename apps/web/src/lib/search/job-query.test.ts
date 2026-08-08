import { describe, expect, it } from "vitest";

import {
  addKeyword,
  EMPTY_QUERY,
  isFiltered,
  jobsHref,
  parseJobQuery,
  removeKeyword,
  toggleFacet,
  withPage,
  type JobQuery,
} from "@/lib/search/job-query";

// The round trip the whole feature rests on: a URL becomes state, state becomes
// a URL, and someone pasting that URL lands on the same results.
function roundTrip(query: JobQuery): JobQuery {
  const href = jobsHref(query);
  const raw: Record<string, string[]> = {};

  new URL(href, "https://example.com").searchParams.forEach((value, key) => {
    raw[key] = [...(raw[key] ?? []), value];
  });

  return parseJobQuery(raw);
}

describe("parseJobQuery", () => {
  it("reads a single value, a repeated value, and an absent one", () => {
    const query = parseJobQuery({
      team: "Engineering",
      location: ["USA - Remote", "Tokyo,Japan"],
      q: "senior",
    });

    expect(query.team).toEqual(["Engineering"]);
    expect(query.location).toEqual(["Tokyo,Japan", "USA - Remote"]);
    expect(query.keywords).toEqual(["senior"]);
    expect(query.workType).toEqual([]);
    expect(query.page).toBe(1);
  });

  it("drops blanks and duplicates so two spellings are one state", () => {
    const query = parseJobQuery({ team: ["Engineering", "", "  ", "Engineering"] });

    expect(query.team).toEqual(["Engineering"]);
  });

  // Anything that is not a whole page number is page 1 rather than an error.
  it.each([
    ["0", 1],
    ["-3", 1],
    ["1.5", 1],
    ["banana", 1],
    ["", 1],
    ["4", 4],
  ])("reads page=%s as %i", (raw, expected) => {
    expect(parseJobQuery({ page: raw }).page).toBe(expected);
  });
});

describe("jobsHref", () => {
  it("is a bare path when nothing is selected", () => {
    expect(jobsHref(EMPTY_QUERY)).toBe("/");
  });

  // / and /?page=1 are the same page; only one of them should exist.
  it("leaves page 1 out but writes any later page", () => {
    expect(jobsHref(withPage(EMPTY_QUERY, 1))).toBe("/");
    expect(jobsHref(withPage(EMPTY_QUERY, 3))).toBe("/?page=3");
  });

  it("writes the same URL whatever order the values arrived in", () => {
    const a: JobQuery = { ...EMPTY_QUERY, team: ["Marketing", "Engineering"] };
    const b: JobQuery = { ...EMPTY_QUERY, team: ["Engineering", "Marketing"] };

    expect(jobsHref(parseJobQuery({ team: a.team }))).toBe(
      jobsHref(parseJobQuery({ team: b.team })),
    );
  });

  it("survives values with commas, spaces and ampersands", () => {
    const query: JobQuery = {
      ...EMPTY_QUERY,
      location: ["Los Angeles,California,United States of America"],
      team: ["Data & Insights"],
      keywords: ["staff engineer"],
      page: 2,
    };

    expect(roundTrip(query)).toEqual(query);
  });
});

describe("round trip", () => {
  it.each([
    ["empty", EMPTY_QUERY],
    ["one facet", { ...EMPTY_QUERY, team: ["Engineering"] }],
    [
      "every facet plus keywords and a page",
      {
        team: ["Advertising", "Engineering"],
        workType: ["Remote"],
        location: ["Tokyo,Japan", "USA - Remote"],
        keywords: ["design", "senior"],
        page: 7,
      },
    ],
  ])("restores %s exactly", (_name, query) => {
    expect(roundTrip(query as JobQuery)).toEqual(query);
  });
});

describe("mutations", () => {
  it("toggles a facet value on and back off", () => {
    const on = toggleFacet(EMPTY_QUERY, "team", "Engineering");
    expect(on.team).toEqual(["Engineering"]);
    expect(toggleFacet(on, "team", "Engineering").team).toEqual([]);
  });

  // Being left on page 7 of a 2-page result set is the bug this prevents.
  it("returns to page 1 on every change", () => {
    const start = withPage(EMPTY_QUERY, 7);

    expect(toggleFacet(start, "team", "Engineering").page).toBe(1);
    expect(addKeyword(start, "design").page).toBe(1);
    expect(removeKeyword(start, "design").page).toBe(1);
  });

  it("ignores a blank or repeated keyword", () => {
    const one = addKeyword(EMPTY_QUERY, "design");

    expect(addKeyword(one, "  ").keywords).toEqual(["design"]);
    expect(addKeyword(one, "design").keywords).toEqual(["design"]);
    expect(addKeyword(one, "senior").keywords).toEqual(["design", "senior"]);
  });

  it("trims a keyword before storing it", () => {
    expect(addKeyword(EMPTY_QUERY, "  remote  ").keywords).toEqual(["remote"]);
  });

  it("removes a keyword by exact value", () => {
    const two = addKeyword(addKeyword(EMPTY_QUERY, "design"), "senior");

    expect(removeKeyword(two, "design").keywords).toEqual(["senior"]);
  });

  it("knows whether anything is filtering", () => {
    expect(isFiltered(EMPTY_QUERY)).toBe(false);
    expect(isFiltered(withPage(EMPTY_QUERY, 4))).toBe(false);
    expect(isFiltered(toggleFacet(EMPTY_QUERY, "location", "Tokyo,Japan"))).toBe(true);
    expect(isFiltered(addKeyword(EMPTY_QUERY, "design"))).toBe(true);
  });
});
