import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FacetGroup } from "@/app/(site)/_listing/facet-group";
import { NavigateProvider } from "@/app/(site)/_listing/use-query-navigation";
import type { FacetOption } from "@/lib/search/facet-counts";
import { EMPTY_QUERY, type JobQuery } from "@/lib/search/job-query";

// What one row of a facet SAYS, and what the group says about its own
// selections. How many rows are on screen is the disclosure question, and it
// is facet-options.test.tsx.
const navigate = vi.fn();

beforeEach(() => navigate.mockClear());
afterEach(cleanup);

// 12 teams, so the default slice of 5 leaves 7 behind.
const OPTIONS: FacetOption[] = Array.from({ length: 12 }, (_, i) => ({
  value: `Team ${i}`,
  label: `Team ${i}`,
  count: 100 - i,
  selected: false,
}));

function renderGroup(options: FacetOption[], query: JobQuery = EMPTY_QUERY) {
  return render(
    <NavigateProvider value={navigate}>
      <FacetGroup
        facetKey="team"
        legend="Team"
        options={options}
        plural="teams"
        query={query}
      />
    </NavigateProvider>,
  );
}

// A tally, and NOTHING ELSE. The panel used to also carry a sentence about how
// the counts are worked out -- "Counts ignore this filter so you can widen it"
// -- which is the panel explaining its own machinery to someone who came here
// to find a job. The number says what clicking does; if that needs a paragraph
// of defence, the number is the thing to fix.
describe("active facet feedback", () => {
  it("says nothing extra while the facet is not filtering", () => {
    renderGroup(OPTIONS);

    expect(screen.queryByText(/selected/)).toBeNull();
  });

  it("shows a live tally once it is, and no explanation of the counts", () => {
    const options = OPTIONS.map((option, i) =>
      i < 2 ? { ...option, selected: true } : option,
    );
    renderGroup(options, { ...EMPTY_QUERY, team: ["Team 0", "Team 1"] });

    expect(screen.getByText("2 selected")).toBeTruthy();
    expect(screen.queryByText(/Counts ignore/)).toBeNull();
    expect(screen.queryByText(/filter is applied/)).toBeNull();
  });

  it("marks the selected rows as on, not merely ticked", () => {
    const options = OPTIONS.map((option, i) =>
      i === 0 ? { ...option, selected: true } : option,
    );
    renderGroup(options, { ...EMPTY_QUERY, team: ["Team 0"] });

    // Exact names: every one of the twelve is in the DOM now, so /Team 1/ would
    // also find "Team 10" and "Team 11". The count is part of the name -- see
    // option-count.tsx -- so the name is the whole phrase.
    const on = screen.getByRole("checkbox", { name: "Team 0 100 roles" }).closest("label");
    const off = screen.getByRole("checkbox", { name: "Team 1 99 roles" }).closest("label");

    expect(on?.className).toContain("option--on");
    expect(off?.className).not.toContain("option--on");
  });
});

/**
 * THE LAST OF THE "Filters5 applied" FAMILY.
 *
 * The option label and its count were adjacent runs in the DOM held apart by
 * .option's flex gap alone, so the row copied and read as "Onsite88" and would
 * have painted that way the moment jobs-options.css was stale. aria-hidden made
 * that string silent rather than correct, and silenced the count with it.
 */
describe("the option label and its count", () => {
  it("separates them in the text, not in the gap", () => {
    renderGroup(OPTIONS);

    const label = screen.getAllByRole("checkbox")[0].closest("label");

    // textContent, deliberately: this is the string a copy, an accessible name
    // and a stylesheet-less render all see. Glued, it reads "Team 0100".
    expect(label?.textContent).toContain("Team 0 100");
  });

  it("says what the number counts, instead of hiding it", () => {
    renderGroup([{ ...OPTIONS[0], count: 1 }, OPTIONS[1]]);

    expect(screen.getByRole("checkbox", { name: "Team 0 1 role" })).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Team 1 99 roles" })).toBeTruthy();
  });
});
