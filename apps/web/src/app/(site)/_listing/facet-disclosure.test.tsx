import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FacetGroup } from "@/app/(site)/_listing/facet-group";
import {
  MIN_HIDDEN_OPTIONS,
  VISIBLE_OPTIONS,
} from "@/app/(site)/_listing/facet-disclosure";
import { NavigateProvider } from "@/app/(site)/_listing/use-query-navigation";
import type { FacetOption } from "@/lib/search/facet-counts";
import { EMPTY_QUERY, type JobQuery } from "@/lib/search/job-query";

// The boundary itself, kept apart from facet-options.test.tsx -- that file pins
// what the OPEN list holds and what the summary promises; this one pins the two
// controls that exist only while something is hidden, and the single fact both
// of them read. Its own file to stay under the 200-line limit.

const navigate = vi.fn();

beforeEach(() => navigate.mockClear());
afterEach(cleanup);

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
const disclosure = () => document.querySelector("details");
const openList = () => screen.getAllByRole("list")[0];

/**
 * THE THREE-ROW FLOOR.
 *
 * A control that reveals one row is taller than the row it reveals. The rule is
 * in .cursor/rules/ui-style-guide.mdc and the number is in facet-disclosure.ts;
 * this is the boundary, walked one option at a time.
 */
describe("the smallest tail worth a disclosure", () => {
  const withTail = (hidden: number) => OPTIONS.slice(0, VISIBLE_OPTIONS + hidden);

  it("shows every option and no control when one would be hidden", () => {
    renderGroup(withTail(1));

    expect(disclosure()).toBeNull();
    expect(openList().querySelectorAll("input")).toHaveLength(VISIBLE_OPTIONS + 1);
  });

  it("still shows every option when two would be hidden", () => {
    renderGroup(withTail(2));

    expect(disclosure()).toBeNull();
    expect(openList().querySelectorAll("input")).toHaveLength(VISIBLE_OPTIONS + 2);
  });

  it("folds the tail away at exactly three", () => {
    renderGroup(withTail(MIN_HIDDEN_OPTIONS));

    expect(openList().querySelectorAll("input")).toHaveLength(VISIBLE_OPTIONS);
    expect(disclosure()!.querySelector("summary")!.textContent).toContain(
      `Show ${MIN_HIDDEN_OPTIONS} more teams`,
    );
  });

  // The tail is measured AFTER selected options are pulled up out of it, so
  // ticking a box can drop a group below the floor and take the control with it.
  it("drops the control when a selection shortens the tail past the floor", () => {
    const options = withTail(MIN_HIDDEN_OPTIONS).map((option, i) =>
      i === VISIBLE_OPTIONS + 2 ? { ...option, selected: true } : option,
    );
    renderGroup(options, { ...EMPTY_QUERY, team: [`Team ${VISIBLE_OPTIONS + 2}`] });

    expect(disclosure()).toBeNull();
    expect(boxes()).toHaveLength(VISIBLE_OPTIONS + MIN_HIDDEN_OPTIONS);
  });
});

/**
 * THE SEARCH BOX IS THE SAME FACT.
 *
 * A field that narrows a list you can already read in full has nothing to find,
 * so it is the disclosure's own predicate that decides whether it renders --
 * hidesOptions, once, over the full list. Both halves are asserted here so a
 * change that teaches one of them a different threshold fails.
 */
describe("the option search", () => {
  const search = () => document.querySelector("input[type='search']");

  it("does not render when every option is visible", () => {
    renderGroup(OPTIONS.slice(0, VISIBLE_OPTIONS));

    expect(search()).toBeNull();
    expect(screen.queryByLabelText("Search teams")).toBeNull();
  });

  it("does not render when the tail is under the disclosure floor", () => {
    renderGroup(OPTIONS.slice(0, VISIBLE_OPTIONS + MIN_HIDDEN_OPTIONS - 1));

    expect(search()).toBeNull();
  });

  it("renders exactly when the disclosure does", () => {
    renderGroup(OPTIONS.slice(0, VISIBLE_OPTIONS + MIN_HIDDEN_OPTIONS));

    expect(search()).toBeTruthy();
    expect(disclosure()).toBeTruthy();
  });

  // Its label and its placeholder are the same string, and the label is a real
  // <label> -- both have to disappear with the field rather than being orphaned.
  it("takes its label with it", () => {
    renderGroup(OPTIONS.slice(0, VISIBLE_OPTIONS));

    expect(document.body.textContent).not.toContain("Search teams");
  });
});

// The option search narrows what is on screen only. It must never navigate --
// typing "market" is not a filter on the jobs, it is a filter on the checkboxes.
// It lives here rather than in facet-group.test.tsx because whether it renders
// at all is the rule above, and it needs a list long enough to trip that rule.
const NAMED = [
  "Engineering",
  "Marketing",
  ...Array.from({ length: 8 }, (_, i) => `Team ${i}`),
];

const renderManyTeams = () =>
  renderGroup(
    NAMED.map((label) => ({ value: label, label, count: 1, selected: false })),
  );

const checkbox = (name: RegExp) => screen.getByRole("checkbox", { name });

describe("facet option search", () => {
  it("narrows the options without touching the URL", () => {
    renderManyTeams();

    fireEvent.change(screen.getByLabelText("Search teams"), {
      target: { value: "market" },
    });

    expect(checkbox(/Marketing/)).toBeTruthy();
    expect(screen.queryByRole("checkbox", { name: /Engineering/ })).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("says so when nothing matches", () => {
    renderManyTeams();

    fireEvent.change(screen.getByLabelText("Search teams"), {
      target: { value: "atlantis" },
    });

    expect(screen.getByText("No matches")).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  // A search that narrows the list to nothing must not take its own box away --
  // the field is decided from the full list, so it survives whatever is typed
  // into it.
  it("keeps the box while a search has emptied the list", () => {
    renderManyTeams();

    fireEvent.change(screen.getByLabelText("Search teams"), {
      target: { value: "atlantis" },
    });

    expect(screen.getByLabelText("Search teams")).toBeTruthy();
  });

  // The search label is built from the same plural noun the disclosure below
  // uses, so the two cannot end up naming the same group different things.
  it("gives the group a name and the search box a real label", () => {
    renderManyTeams();

    expect(screen.getByRole("group", { name: "Team" })).toBeTruthy();
    expect(screen.getByLabelText("Search teams").getAttribute("type")).toBe("search");
  });
});
