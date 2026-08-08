import { describe, expect, it } from "vitest";

import { BOARD, summary } from "@/lib/jobs/job-summary.fixture";
import { facetOptions, matchOptions } from "@/lib/search/facet-counts";
import { EMPTY_QUERY, toggleFacet, type JobQuery } from "@/lib/search/job-query";

const counts = (options: { value: string; count: number }[]) =>
  Object.fromEntries(options.map((option) => [option.value, option.count]));

describe("facetOptions", () => {
  it("counts every value in the facet when nothing is selected", () => {
    expect(counts(facetOptions(BOARD, EMPTY_QUERY, "team"))).toEqual({
      Engineering: 3,
      Marketing: 2,
    });
    expect(counts(facetOptions(BOARD, EMPTY_QUERY, "workType"))).toEqual({
      Onsite: 3,
      Remote: 2,
    });
  });

  // A job posted in several locations counts once against each of them, so the
  // location counts sum to more than the number of jobs. That is correct.
  it("counts a multi-location job under each of its locations", () => {
    expect(counts(facetOptions(BOARD, EMPTY_QUERY, "location"))).toEqual({
      "Los Gatos,California,United States of America": 2,
      "USA - Remote": 2,
      "Tokyo,Japan": 1,
      "New York,New York,United States of America": 1,
    });
  });

  it("sorts by count, then by label for ties", () => {
    const labels = facetOptions(BOARD, EMPTY_QUERY, "location").map((o) => o.label);

    expect(labels[0]).toBe("Los Gatos, California, United States of America");
    expect(labels.slice(2)).toEqual([
      "New York, New York, United States of America",
      "Tokyo, Japan",
    ]);
  });

  it("formats a location label but keeps the stored value", () => {
    const tokyo = facetOptions(BOARD, EMPTY_QUERY, "location").find(
      (option) => option.value === "Tokyo,Japan",
    );

    expect(tokyo?.label).toBe("Tokyo, Japan");
  });

  // The whole point of counting with the facet's own selections dropped: after
  // ticking Engineering, Marketing must still show what adding it would bring.
  it("keeps its own options countable once one is selected", () => {
    const query = toggleFacet(EMPTY_QUERY, "team", "Engineering");
    const options = facetOptions(BOARD, query, "team");

    expect(counts(options)).toEqual({ Engineering: 3, Marketing: 2 });
    expect(options.find((o) => o.value === "Engineering")?.selected).toBe(true);
    expect(options.find((o) => o.value === "Marketing")?.selected).toBe(false);
  });

  // Every OTHER facet still applies, which is what makes the number a real
  // preview of the result set rather than a board-wide total.
  it("narrows a facet by the other facets' selections", () => {
    const query = toggleFacet(EMPTY_QUERY, "workType", "Remote");

    expect(counts(facetOptions(BOARD, query, "team"))).toEqual({
      Engineering: 1,
      Marketing: 1,
    });
  });

  it("narrows a facet by the active keywords", () => {
    const query: JobQuery = { ...EMPTY_QUERY, keywords: ["designer"] };

    expect(counts(facetOptions(BOARD, query, "team"))).toEqual({ Marketing: 1 });
  });

  // Otherwise the only control that could clear the filter would disappear and
  // the visitor would be stuck with an empty list.
  it("keeps a selected option visible at zero", () => {
    const board = [...BOARD, summary({ team: "Legal", work_type: "Onsite" })];
    const query = toggleFacet(
      toggleFacet(EMPTY_QUERY, "team", "Legal"),
      "workType",
      "Remote",
    );
    const options = facetOptions(board, query, "team");

    expect(options.find((o) => o.value === "Legal")).toMatchObject({
      count: 0,
      selected: true,
    });
  });

  it("returns nothing for a facet no job carries a value for", () => {
    const board = [summary({ team: null }), summary({ team: null })];

    expect(facetOptions(board, EMPTY_QUERY, "team")).toEqual([]);
  });
});

describe("matchOptions", () => {
  const options = facetOptions(BOARD, EMPTY_QUERY, "location");

  it("returns everything for a blank search", () => {
    expect(matchOptions(options, "")).toHaveLength(4);
    expect(matchOptions(options, "   ")).toHaveLength(4);
  });

  it("matches the readable label, case-insensitively", () => {
    expect(matchOptions(options, "tokyo").map((o) => o.value)).toEqual([
      "Tokyo,Japan",
    ]);
    expect(matchOptions(options, "new york")).toHaveLength(1);
  });

  it("also matches the stored value", () => {
    expect(matchOptions(options, "USA -").map((o) => o.value)).toEqual([
      "USA - Remote",
    ]);
  });

  it("returns nothing when no option matches", () => {
    expect(matchOptions(options, "atlantis")).toEqual([]);
  });
});
