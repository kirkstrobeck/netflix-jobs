import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FacetGroup } from "@/app/(site)/_listing/facet-group";
import { KeywordFacet } from "@/app/(site)/_listing/keyword-facet";
import { NavigateProvider } from "@/app/(site)/_listing/use-query-navigation";
import { siteCatalog } from "@/lib/jobs/board";
import { JOBS, SITES } from "@/lib/jobs/job-summary.fixture";
import { facetOptions } from "@/lib/search/facet-counts";
import { EMPTY_QUERY, jobsHref, toggleFacet, type JobQuery } from "@/lib/search/job-query";

const navigate = vi.fn();

// Controls hand over a query, not a URL. Reading it back as a URL is still the
// clearest way to state the expectation, and it is the same serialiser the
// address bar gets, so the assertion is the contract rather than a shape.
const navigatedTo = () => jobsHref(navigate.mock.calls.at(-1)![0]);

const mount = (ui: ReactNode) =>
  render(<NavigateProvider value={navigate}>{ui}</NavigateProvider>);

beforeEach(() => navigate.mockClear());
// The vitest config does not set `globals`, so Testing Library's automatic
// cleanup is never registered and renders would pile up across tests.
afterEach(cleanup);

const checkbox = (name: RegExp) =>
  screen.getByRole("checkbox", { name }) as HTMLInputElement;

function renderTeams(query: JobQuery = EMPTY_QUERY) {
  return mount(
    <FacetGroup
      facetKey="team"
      legend="Team"
      options={facetOptions(JOBS, query, "team", siteCatalog(SITES))}
      plural="teams"
      query={query}
      singular="team"
    />,
  );
}

// The draft is owned by useListing in the real tree, because it filters the list
// as it is typed. Here a local holder stands in for that.
function Keywords({ query }: { query: JobQuery }) {
  const [draft, setDraft] = useState("");

  return <KeywordFacet draft={draft} onDraft={setDraft} query={query} />;
}

// The round trip the URL contract depends on: a control states the new query and
// nothing else. Whether that costs a round trip is useListing's decision, not
// the control's, so there is one kind of control rather than two.
describe("facet to URL", () => {
  it("navigates to the URL that selects the option", () => {
    renderTeams();

    fireEvent.click(checkbox(/Engineering/));

    expect(navigatedTo()).toBe("/?team=Engineering");
  });

  it("navigates to the URL that clears an already-selected option", () => {
    renderTeams(toggleFacet(EMPTY_QUERY, "team", "Engineering"));

    fireEvent.click(checkbox(/Engineering/));

    expect(navigatedTo()).toBe("/");
  });

  it("keeps the other facets and drops back to page 1", () => {
    const query: JobQuery = {
      ...EMPTY_QUERY,
      workType: ["Remote"],
      keywords: ["design"],
      page: 6,
    };
    renderTeams(query);

    fireEvent.click(checkbox(/Marketing/));

    expect(navigatedTo()).toBe("/?type=Remote&team=Marketing&q=design");
  });

  it("shows each option with its count and its checked state", () => {
    renderTeams(toggleFacet(EMPTY_QUERY, "team", "Engineering"));

    expect(checkbox(/Engineering/).checked).toBe(true);
    expect(checkbox(/Marketing/).checked).toBe(false);

    const list = screen.getByRole("list");
    expect(within(list).getByText("3")).toBeTruthy();
    expect(within(list).getByText("2")).toBeTruthy();
  });
});

// The option search narrows what is on screen only. It must never navigate --
// typing "market" is not a filter on the jobs, it is a filter on the checkboxes.
describe("facet option search", () => {
  it("narrows the options without touching the URL", () => {
    renderTeams();

    fireEvent.change(screen.getByLabelText("Search teams"), {
      target: { value: "market" },
    });

    expect(checkbox(/Marketing/)).toBeTruthy();
    expect(screen.queryByRole("checkbox", { name: /Engineering/ })).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("says so when nothing matches", () => {
    renderTeams();

    fireEvent.change(screen.getByLabelText("Search teams"), {
      target: { value: "atlantis" },
    });

    expect(screen.getByText("No matches")).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  // The search label is built from the same plural noun the disclosure below
  // uses, so the two cannot end up naming the same group different things.
  it("gives the group a name and the search box a real label", () => {
    renderTeams();

    expect(screen.getByRole("group", { name: "Team" })).toBeTruthy();
    expect(screen.getByLabelText("Search teams").getAttribute("type")).toBe("search");
  });
});

describe("keywords to URL", () => {
  it("adds a chip through the URL when the form is submitted", () => {
    mount(<Keywords query={EMPTY_QUERY} />);

    fireEvent.change(screen.getByLabelText("Keywords"), {
      target: { value: "design" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(navigatedTo()).toBe("/?q=design");
  });

  it("ignores a blank keyword", () => {
    mount(<Keywords query={EMPTY_QUERY} />);

    fireEvent.change(screen.getByLabelText("Keywords"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(navigatedTo()).toBe("/");
  });

  it("removes a chip through the URL, keeping the others", () => {
    mount(<Keywords query={{ ...EMPTY_QUERY, keywords: ["design", "senior"] }} />);

    fireEvent.click(screen.getByRole("button", { name: "Remove keyword: design" }));

    expect(navigatedTo()).toBe("/?q=senior");
  });

  it("renders one chip per active keyword", () => {
    mount(<Keywords query={{ ...EMPTY_QUERY, keywords: ["design", "senior"] }} />);

    expect(screen.getAllByRole("button", { name: /Remove keyword:/ })).toHaveLength(2);
  });

  it("renders no chip list when there are no keywords", () => {
    mount(<Keywords query={EMPTY_QUERY} />);

    expect(screen.queryByRole("button", { name: /Remove keyword:/ })).toBeNull();
  });
});

/**
 * The same regression as the filters heading, in the group legends.
 *
 * A <legend> IS the fieldset's accessible name, so "Location" glued to
 * "1 selected" was announced as "Location1 selected" -- and copied that way,
 * and painted that way whenever the stylesheet was late. The margin does the
 * optical spacing; the space itself has to be in the text.
 */
describe("the group legend and its tally", () => {
  it("separates the group name from the count in the text", () => {
    renderTeams({ ...EMPTY_QUERY, team: ["Engineering"] });

    // getByRole matches on the computed accessible name, so this fails on the
    // glued string and passes only on the separated one.
    expect(screen.getByRole("group", { name: "Team 1 selected" })).toBeTruthy();
  });

  it("shows no tally at all when nothing is selected", () => {
    renderTeams();

    expect(screen.getByRole("group", { name: "Team" })).toBeTruthy();
  });
});
