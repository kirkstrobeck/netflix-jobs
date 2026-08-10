import { describe, expect, it } from "vitest";

import {
  addKeyword,
  appliedCount,
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

  // The same fold one facet over. The slugs are lower case in seniority.ts and
  // in every link the panel writes, so `?level=Senior` is that rung, not a
  // seventh one -- and the two spellings together are still one selection.
  it("folds the case of a seniority slug", () => {
    expect(parseJobQuery({ level: ["Senior", "senior"] }).seniority).toEqual([
      "senior",
    ]);
  });

  // Unknown values are not rejected here any more than an unknown team is. It
  // matches nothing and renders as a box that can be unticked, which is a URL
  // a visitor can get out of.
  it("keeps a seniority slug it does not recognise", () => {
    expect(parseJobQuery({ level: "archmage" }).seniority).toEqual(["archmage"]);
  });

  /**
   * `?country=all` used to mean "everywhere, and I mean it" -- an answer the
   * URL could give that a bare `/` could not. The URL has no word for it now:
   * an old link carrying it reads as a URL that names no country, which is
   * exactly what `/` is. The cookie is what remembers the answer instead.
   */
  it("reads an old ?country=all as naming no country at all", () => {
    expect(parseJobQuery({ country: "all" })).toMatchObject({ country: [] });
    expect(parseJobQuery({})).toMatchObject({ country: [] });
  });

  it("never lets the sentinel through as a country to match on", () => {
    expect(parseJobQuery({ country: ["all", "JP"] }).country).toEqual(["JP"]);
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

  // The URL always mirrors the active facets: selecting writes the param,
  // deselecting removes it, and nothing is left behind in between.
  it("writes a seniority as `level`, and drops it when it is cleared", () => {
    const on = toggleFacet(EMPTY_QUERY, "seniority", "senior");
    const two = toggleFacet(on, "seniority", "staff");

    expect(jobsHref(on)).toBe("/?level=senior");
    expect(jobsHref(two)).toBe("/?level=senior&level=staff");
    expect(jobsHref(toggleFacet(two, "seniority", "senior"))).toBe("/?level=staff");
    expect(jobsHref(toggleFacet(on, "seniority", "senior"))).toBe("/");
  });

  // Seniority is last in FACET_KEYS, appended rather than slotted in beside
  // work type, so every link shared before it existed still writes byte for
  // byte the URL it always did.
  it("writes seniority after the facets that came before it", () => {
    const query: JobQuery = {
      ...EMPTY_QUERY,
      country: ["US"],
      workType: ["Remote"],
      seniority: ["staff"],
    };

    expect(jobsHref(query)).toBe("/?country=US&type=Remote&level=staff");
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

  // Everywhere is the absence of a country filter, so it is spelled by leaving
  // the param off -- the same way newest and page 1 are. The word `all` must
  // never appear in an address again.
  it("never writes a country for a listing that has none", () => {
    expect(jobsHref({ ...EMPTY_QUERY, team: ["Engineering"] })).toBe("/?team=Engineering");
  });
});

describe("round trip", () => {
  it.each([
    ["empty", EMPTY_QUERY],
    ["one facet", { ...EMPTY_QUERY, team: ["Engineering"] }],
    ["a sort", { ...EMPTY_QUERY, sort: "nearest" }],
    [
      "every facet plus keywords, a sort and a page",
      {
        team: ["Advertising", "Engineering"],
        workType: ["Remote"],
        businessUnit: ["Animation"],
        country: ["JP", "US"],
        site: ["jp-tokyo", "us-remote"],
        seniority: ["senior", "staff"],
        keywords: ["design", "senior"],
        sort: "nearest",
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

  // What the collapsed filters toggle says out loud: every ticked box and every
  // chip, once each. Sort and page are not filters -- one reorders the list and
  // the other walks it.
  it("counts every applied filter and nothing that is not one", () => {
    const five = { ...EMPTY_QUERY, country: ["JP", "US"], site: ["us-remote"],
      workType: ["Remote"], keywords: ["design"] };

    expect(appliedCount(EMPTY_QUERY)).toBe(0);
    expect(appliedCount({ ...EMPTY_QUERY, sort: "nearest", page: 3 })).toBe(0);
    expect(appliedCount(five)).toBe(5);
  });

  it("knows whether anything is filtering", () => {
    expect(isFiltered(EMPTY_QUERY)).toBe(false);
    expect(isFiltered(withPage(EMPTY_QUERY, 4))).toBe(false);
    expect(isFiltered(toggleFacet(EMPTY_QUERY, "country", "JP"))).toBe(true);
    expect(isFiltered(addKeyword(EMPTY_QUERY, "design"))).toBe(true);
  });
});
