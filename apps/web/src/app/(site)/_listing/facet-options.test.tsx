import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FacetGroup } from "@/app/(site)/_listing/facet-group";
import { VISIBLE_OPTIONS } from "@/app/(site)/_listing/facet-options";
import type { FacetOption } from "@/lib/search/facet-counts";
import { EMPTY_QUERY, type JobQuery } from "@/lib/search/job-query";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: (...args: unknown[]) => push(...args) }),
}));

beforeEach(() => push.mockClear());
afterEach(cleanup);

// 12 teams, so the default slice of 8 leaves 4 behind.
const OPTIONS: FacetOption[] = Array.from({ length: 12 }, (_, i) => ({
  value: `Team ${i}`,
  label: `Team ${i}`,
  count: 100 - i,
  selected: false,
}));

function renderGroup(options: FacetOption[], query: JobQuery = EMPTY_QUERY) {
  return render(
    <FacetGroup
      facetKey="team"
      legend="Team"
      options={options}
      query={query}
      searchLabel="Search teams"
    />,
  );
}

const boxes = () => screen.queryAllByRole("checkbox");

describe("option list length", () => {
  it("shows a fixed slice and offers the rest", () => {
    renderGroup(OPTIONS);

    expect(boxes()).toHaveLength(VISIBLE_OPTIONS);
    // "Show all 12", not "Show more": the count is the useful half of the
    // promise -- two more rows and twenty-nine are different offers.
    expect(screen.getByRole("button", { name: "Show all 12" })).toBeTruthy();
  });

  it("reveals the rest and collapses again", () => {
    renderGroup(OPTIONS);

    fireEvent.click(screen.getByRole("button", { name: "Show all 12" }));
    expect(boxes()).toHaveLength(12);

    fireEvent.click(screen.getByRole("button", { name: /Show fewer/ }));
    expect(boxes()).toHaveLength(VISIBLE_OPTIONS);
  });

  // Work type has exactly two values; a control there would be noise.
  it("offers no control when everything already fits", () => {
    renderGroup(OPTIONS.slice(0, VISIBLE_OPTIONS));

    expect(boxes()).toHaveLength(VISIBLE_OPTIONS);
    expect(screen.queryByRole("button", { name: /Show all|Show fewer/ })).toBeNull();
  });

  // Truncating a selected option away would hide the only control that could
  // clear it, and the list must not reorder to avoid that.
  it("always shows a selected option, however far down it sits", () => {
    const options = OPTIONS.map((option, i) =>
      i === 11 ? { ...option, selected: true } : option,
    );
    renderGroup(options, { ...EMPTY_QUERY, team: ["Team 11"] });

    expect(screen.getByRole("checkbox", { name: /Team 11/ })).toBeTruthy();
    expect(boxes()).toHaveLength(VISIBLE_OPTIONS + 1);
    // Widened, not sorted: the first option is still the first option.
    expect(boxes()[0].closest("label")?.textContent).toContain("Team 0");
  });

  it("names the list it controls and reports its state", () => {
    renderGroup(OPTIONS);

    const button = screen.getByRole("button", { name: "Show all 12" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.getAttribute("aria-controls")).toBe(
      screen.getByRole("list").getAttribute("id"),
    );

    fireEvent.click(button);
    expect(
      screen.getByRole("button", { name: /Show fewer/ }).getAttribute("aria-expanded"),
    ).toBe("true");
  });

  it("nothing in the panel scrolls", () => {
    renderGroup(OPTIONS);

    expect(screen.getByRole("list").className).toBe("facet__options");
  });
});

// The counts in an active facet are deliberately blind to that facet's own
// selections. That is right, but a number that will not move after a click looks
// broken -- so the facet says what it is doing instead of leaving it to be
// inferred.
describe("active facet feedback", () => {
  it("says nothing extra while the facet is not filtering", () => {
    renderGroup(OPTIONS);

    expect(screen.queryByText(/selected/)).toBeNull();
    expect(screen.queryByText(/Counts ignore this filter/)).toBeNull();
  });

  it("shows a live tally and explains the pinned counts once it is", () => {
    const options = OPTIONS.map((option, i) =>
      i < 2 ? { ...option, selected: true } : option,
    );
    renderGroup(options, { ...EMPTY_QUERY, team: ["Team 0", "Team 1"] });

    expect(screen.getByText("2 selected")).toBeTruthy();
    expect(screen.getByText(/Counts ignore this filter so you can widen it/)).toBeTruthy();
  });

  it("marks the selected rows as on, not merely ticked", () => {
    const options = OPTIONS.map((option, i) =>
      i === 0 ? { ...option, selected: true } : option,
    );
    renderGroup(options, { ...EMPTY_QUERY, team: ["Team 0"] });

    const on = screen.getByRole("checkbox", { name: /Team 0/ }).closest("label");
    const off = screen.getByRole("checkbox", { name: /Team 1/ }).closest("label");

    expect(on?.className).toContain("option--on");
    expect(off?.className).not.toContain("option--on");
  });
});
