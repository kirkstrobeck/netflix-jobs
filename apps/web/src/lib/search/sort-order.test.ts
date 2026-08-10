import { describe, expect, it } from "vitest";

import { EMPTY_QUERY, jobsHref } from "@/lib/search/job-query";
import { withSort } from "@/lib/search/query-edits";
import { parseJobQuery } from "@/lib/search/parse-query";
import { DEFAULT_SORT, parseSort, sortParam } from "@/lib/search/sort-order";

describe("parseSort", () => {
  it("reads the two spellings", () => {
    expect(parseSort("new")).toBe("newest");
    expect(parseSort("near")).toBe("nearest");
  });

  it("folds case and whitespace", () => {
    expect(parseSort(" NEAR ")).toBe("nearest");
  });

  it.each([undefined, "", "distance", "closest", ["nonsense"]])(
    "falls back to the default for %p",
    (raw) => {
      expect(parseSort(raw as string | string[] | undefined)).toBe(DEFAULT_SORT);
    },
  );

  it("takes the first of a repeated param rather than guessing", () => {
    expect(parseSort(["near", "new"])).toBe("nearest");
  });
});

describe("the sort in a URL", () => {
  // Newest is the board's own order, so an unsorted list has nothing to say
  // about sorting. / and /?sort=new must not be two addresses for one list.
  it("writes nothing for the default", () => {
    expect(jobsHref(EMPTY_QUERY)).toBe("/");
    expect(jobsHref(withSort(EMPTY_QUERY, "newest"))).toBe("/");
  });

  it("writes the short spelling for nearest", () => {
    expect(jobsHref(withSort(EMPTY_QUERY, "nearest"))).toBe("/?sort=near");
    expect(sortParam("nearest")).toBe("near");
  });

  // The composition requirement: a sort is one more thing in the query string,
  // not a replacement for what is already there.
  it("composes with the country and the facets already selected", () => {
    const filtered = {
      ...EMPTY_QUERY,
      country: ["JP"],
      site: ["jp-tokyo"],
      team: ["Engineering"],
      keywords: ["design"],
    };

    expect(jobsHref(withSort(filtered, "nearest"))).toBe(
      "/?country=JP&site=jp-tokyo&team=Engineering&q=design&sort=near",
    );
  });

  it("survives the round trip back off the URL", () => {
    expect(parseJobQuery({ sort: "near", country: "JP" })).toMatchObject({
      sort: "nearest",
      country: ["JP"],
    });
  });

  // Page 3 of a nearest list holds different roles from page 3 of a newest one,
  // so staying on it would land the visitor somewhere they never chose.
  it("returns to page 1", () => {
    expect(withSort({ ...EMPTY_QUERY, page: 7 }, "nearest").page).toBe(1);
  });
});
