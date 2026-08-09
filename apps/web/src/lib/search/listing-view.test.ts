import { describe, expect, it } from "vitest";

import { BOARD } from "@/lib/jobs/job-summary.fixture";
import { toggleCountry } from "@/lib/search/geo-query";
import { deriveListing } from "@/lib/search/listing-view";
import { EMPTY_QUERY, toggleFacet, withPage } from "@/lib/search/job-query";

describe("deriveListing", () => {
  it("returns the page, the window and every facet in one pass", () => {
    const view = deriveListing(BOARD, EMPTY_QUERY);

    expect(view.jobs).toHaveLength(5);
    expect(view.window.total).toBe(5);
    expect(Object.keys(view.facets).sort()).toEqual([
      "country",
      "site",
      "team",
      "workType",
    ]);
  });

  // Detection resolves to a query BEFORE this is called, so what arrives here
  // is only ever "these filters" -- which is what lets the same call on the
  // client, over the same board, reproduce the server's screen exactly.
  it("takes a country only as a query, never as a request", () => {
    const view = deriveListing(BOARD, toggleCountry(EMPTY_QUERY, "JP"));

    expect(view.window.total).toBe(1);
    expect(view.jobs.map((job) => job.title)).toEqual(["Marketing manager"]);
  });

  it("filters the page and the window together", () => {
    const view = deriveListing(BOARD, toggleFacet(EMPTY_QUERY, "team", "Engineering"));

    expect(view.window.total).toBe(3);
    expect(view.jobs.map((job) => job.team)).toEqual([
      "Engineering",
      "Engineering",
      "Engineering",
    ]);
  });

  // The facet a visitor is standing in is counted with its own selection open,
  // which is what keeps the other options in it reachable.
  it("counts a facet's own options as if it were not filtering", () => {
    const view = deriveListing(BOARD, toggleFacet(EMPTY_QUERY, "team", "Engineering"));
    const marketing = view.facets.team.find((option) => option.value === "Marketing");

    expect(marketing?.count).toBe(2);
    expect(view.facets.team.find((o) => o.value === "Engineering")?.selected).toBe(true);
  });

  // Clamping lives in paginate(); this is the assertion that the page handed to
  // the list is cut from the CLAMPED window rather than the requested page.
  it("slices from the clamped page, not the requested one", () => {
    const view = deriveListing(BOARD, withPage(EMPTY_QUERY, 9));

    expect(view.window.page).toBe(1);
    expect(view.jobs).toHaveLength(5);
  });

  it("has an empty page and a zero window when nothing matches", () => {
    const view = deriveListing(BOARD, { ...EMPTY_QUERY, keywords: ["atlantis"] });

    expect(view.jobs).toEqual([]);
    expect(view.window.total).toBe(0);
  });
});
