import { describe, expect, it } from "vitest";

import {
  addKeyword,
  EMPTY_QUERY,
  isFiltered,
  jobsHref,
  removeKeyword,
  toggleFacet,
  withPage,
  type JobQuery,
} from "@/lib/search/job-query";
import { parseJobQuery } from "@/lib/search/parse-query";

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
      country: ["jp", "US"],
      q: "senior",
    });

    expect(query.team).toEqual(["Engineering"]);
    expect(query.country).toEqual(["JP", "US"]);
    expect(query.keywords).toEqual(["senior"]);
    expect(query.workType).toEqual([]);
    expect(query.page).toBe(1);
  });

  it("drops blanks and duplicates so two spellings are one state", () => {
    const query = parseJobQuery({ team: ["Engineering", "", "  ", "Engineering"] });

    expect(query.team).toEqual(["Engineering"]);
  });

  // Codes are upper case everywhere else -- the database, the geo header -- so
  // a hand-typed lower-case one is the same country, not a second one.
  it("folds the case of a country code", () => {
    expect(parseJobQuery({ country: ["us", "US"] }).country).toEqual(["US"]);
  });

  /**
   * `?country=all` and no country param at all are the two states that look
   * identical in a listing and are opposite in intent. The first is a visitor
   * who asked for everywhere; the second is a visitor who has not been asked.
   * Detection is allowed to answer only the second.
   */
  it("tells 'every country' apart from 'no country named'", () => {
    expect(parseJobQuery({ country: "all" })).toMatchObject({
      country: [],
      everywhere: true,
    });
    expect(parseJobQuery({})).toMatchObject({ country: [], everywhere: false });
  });

  it("never lets the sentinel through as a country to match on", () => {
    const query = parseJobQuery({ country: ["all", "JP"] });

    expect(query.country).toEqual(["JP"]);
    expect(query.everywhere).toBe(true);
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
      site: ["us-los-angeles"],
      country: ["US"],
      team: ["Data & Insights"],
      keywords: ["staff engineer"],
      page: 2,
    };

    expect(roundTrip(query)).toEqual(query);
  });
});

// The flag only ever means "no country, and that is the answer". Writing both
// would be two answers to one question, so the specific one wins and the state
// normalises on the way through the URL.
describe("every-country flag beside a named country", () => {
  it("writes only the country", () => {
    const query: JobQuery = { ...EMPTY_QUERY, country: ["JP"], everywhere: true };

    expect(jobsHref(query)).toBe("/?country=JP");
    expect(roundTrip(query)).toEqual({ ...query, everywhere: false });
  });
});

describe("round trip", () => {
  it.each([
    ["empty", EMPTY_QUERY],
    ["one facet", { ...EMPTY_QUERY, team: ["Engineering"] }],
    ["every country, chosen", { ...EMPTY_QUERY, everywhere: true }],
    [
      "every facet plus keywords and a page",
      {
        team: ["Advertising", "Engineering"],
        workType: ["Remote"],
        country: ["JP", "US"],
        site: ["jp-tokyo", "us-remote"],
        everywhere: false,
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
    expect(isFiltered(toggleFacet(EMPTY_QUERY, "country", "JP"))).toBe(true);
    expect(isFiltered(addKeyword(EMPTY_QUERY, "design"))).toBe(true);
  });
});
