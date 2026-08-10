import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FacetGroup } from "@/app/(site)/_listing/facet-group";
import { VISIBLE_OPTIONS } from "@/app/(site)/_listing/facet-disclosure";
import { NavigateProvider } from "@/app/(site)/_listing/use-query-navigation";
import type { FacetOption } from "@/lib/search/facet-counts";
import { EMPTY_QUERY, type JobQuery } from "@/lib/search/job-query";

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

const boxes = () => screen.queryAllByRole("checkbox");

// The rest of the list is inside <details>, which jsdom renders closed. Nothing
// in it is hidden from the accessibility tree, so the boxes are all queryable --
// what the disclosure changes is what is on SCREEN, which is the browser's job
// and not something a DOM test can see. What can be tested is the structure:
// five in the open list, the remainder inside the element that hides them.
const disclosure = () => document.querySelector("details");
const openList = () => screen.getAllByRole("list")[0];

describe("option list length", () => {
  it("shows the top five and puts the rest behind a disclosure", () => {
    renderGroup(OPTIONS);

    expect(openList().querySelectorAll("input")).toHaveLength(VISIBLE_OPTIONS);
    expect(disclosure()?.querySelectorAll("input")).toHaveLength(
      OPTIONS.length - VISIBLE_OPTIONS,
    );
    expect(boxes()).toHaveLength(OPTIONS.length);
  });

  // No button, no state, no script: <details> IS the disclosure, and the
  // browser gives it the keyboard behaviour and the announcement for free.
  it("is a details/summary, not a scripted toggle", () => {
    renderGroup(OPTIONS);

    expect(disclosure()).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Show/ })).toBeNull();
    expect(document.querySelector("[aria-expanded]")).toBeNull();
  });

  // Sentence case, the count, and the noun -- "Show 7 more" alone tells a screen
  // reader nothing about which list it opens. Both labels are in the markup and
  // CSS shows the true one, so neither state has to re-render to tell the truth.
  //
  // The count is what the control REVEALS, not what the group totals: 12 teams
  // with 5 already on screen is a promise of 7, and a reader should not have to
  // do that subtraction to find out whether opening it is worth the click.
  it("names the group and how many more it opens, in both of its labels", () => {
    renderGroup(OPTIONS);

    const summary = disclosure()!.querySelector("summary")!;

    expect(summary.textContent).toContain("Show 7 more teams");
    expect(summary.textContent).toContain("Show fewer teams");
    expect(summary.textContent).not.toContain("12");
  });

  // Pulling a selected option up out of the tail shortens the tail, and the
  // promise has to shorten with it. This is the case the old "Show all 12 teams"
  // wording got outright wrong: six rows would be on screen and the control
  // still offered twelve.
  it("counts the tail after a selected option has been pulled out of it", () => {
    const options = OPTIONS.map((option, i) =>
      i === 11 ? { ...option, selected: true } : option,
    );
    renderGroup(options, { ...EMPTY_QUERY, team: ["Team 11"] });

    expect(disclosure()!.querySelector("summary")!.textContent).toContain(
      "Show 6 more teams",
    );
  });

  // Work type has exactly two values; a disclosure there would be noise.
  it("offers no disclosure when everything already fits", () => {
    renderGroup(OPTIONS.slice(0, VISIBLE_OPTIONS));

    expect(boxes()).toHaveLength(VISIBLE_OPTIONS);
    expect(disclosure()).toBeNull();
  });

  // Leaving a selected option behind the disclosure would hide the only control
  // that could clear it, and the list must not reorder to avoid that.
  it("always shows a selected option in the open list, however far down it sits", () => {
    const options = OPTIONS.map((option, i) =>
      i === 11 ? { ...option, selected: true } : option,
    );
    renderGroup(options, { ...EMPTY_QUERY, team: ["Team 11"] });

    const open = openList().querySelectorAll("input");

    expect(open).toHaveLength(VISIBLE_OPTIONS + 1);
    expect(open[VISIBLE_OPTIONS].closest("label")?.textContent).toContain("Team 11");
    // Widened, not sorted: the first option is still the first option.
    expect(open[0].closest("label")?.textContent).toContain("Team 0");
    // And it is not also down in the hidden remainder.
    expect(disclosure()?.querySelectorAll("input")).toHaveLength(
      OPTIONS.length - VISIBLE_OPTIONS - 1,
    );
  });

  it("nothing in the panel scrolls", () => {
    renderGroup(OPTIONS);

    expect(openList().className).toBe("facet__options");
  });
});

