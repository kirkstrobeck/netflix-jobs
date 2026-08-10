import { describe, expect, it } from "vitest";

import { EMPTY_QUERY } from "@/lib/search/job-query";
import {
  addKeyword,
  appliedCount,
  isFiltered,
  removeKeyword,
  toggleFacet,
  withPage,
} from "@/lib/search/query-edits";

// These are state, not text. Nothing here asserts on a URL -- how a query is
// spelled in the address bar is job-query.test.ts, and it is a separate claim.
describe("edits", () => {
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
});

describe("appliedCount", () => {
  // What the collapsed filters toggle says out loud: every ticked box and every
  // chip, once each. Sort and page are not filters -- one reorders the list and
  // the other walks it.
  it("counts every applied filter and nothing that is not one", () => {
    const five = {
      ...EMPTY_QUERY,
      country: ["JP", "US"],
      site: ["us-remote"],
      workType: ["Remote"],
      keywords: ["design"],
    };

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
