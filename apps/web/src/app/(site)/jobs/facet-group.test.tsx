import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FacetGroup } from "@/app/(site)/jobs/facet-group";
import { KeywordFacet } from "@/app/(site)/jobs/keyword-facet";
import { BOARD } from "@/lib/jobs/job-summary.fixture";
import { facetOptions } from "@/lib/search/facet-counts";
import { EMPTY_QUERY, toggleFacet, type JobQuery } from "@/lib/search/job-query";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: (...args: unknown[]) => push(...args) }),
}));

beforeEach(() => push.mockClear());
// The vitest config does not set `globals`, so Testing Library's automatic
// cleanup is never registered and renders would pile up across tests.
afterEach(cleanup);

const checkbox = (name: RegExp) =>
  screen.getByRole("checkbox", { name }) as HTMLInputElement;

function renderTeams(query: JobQuery = EMPTY_QUERY) {
  return render(
    <FacetGroup
      facetKey="team"
      legend="Team"
      options={facetOptions(BOARD, query, "team")}
      query={query}
      searchLabel="Search teams"
    />,
  );
}

// The round trip the URL contract depends on: a control writes state to the URL,
// and nothing else. Scrolling is suppressed because the panel is often below the
// fold and jumping to the top would lose the visitor's place.
describe("facet to URL", () => {
  it("navigates to the URL that selects the option", () => {
    renderTeams();

    fireEvent.click(checkbox(/Engineering/));

    expect(push).toHaveBeenCalledWith("/jobs?team=Engineering", { scroll: false });
  });

  it("navigates to the URL that clears an already-selected option", () => {
    renderTeams(toggleFacet(EMPTY_QUERY, "team", "Engineering"));

    fireEvent.click(checkbox(/Engineering/));

    expect(push).toHaveBeenCalledWith("/jobs", { scroll: false });
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

    expect(push).toHaveBeenCalledWith("/jobs?team=Marketing&type=Remote&q=design", {
      scroll: false,
    });
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
    expect(push).not.toHaveBeenCalled();
  });

  it("says so when nothing matches", () => {
    renderTeams();

    fireEvent.change(screen.getByLabelText("Search teams"), {
      target: { value: "atlantis" },
    });

    expect(screen.getByText("No matches")).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("gives the group a name and the search box a real label", () => {
    renderTeams();

    expect(screen.getByRole("group", { name: "Team" })).toBeTruthy();
    expect(screen.getByLabelText("Search teams").getAttribute("type")).toBe("search");
  });
});

describe("keywords to URL", () => {
  it("adds a chip through the URL when the form is submitted", () => {
    render(<KeywordFacet query={EMPTY_QUERY} />);

    fireEvent.change(screen.getByLabelText("Keywords"), {
      target: { value: "design" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(push).toHaveBeenCalledWith("/jobs?q=design", { scroll: false });
  });

  it("ignores a blank keyword", () => {
    render(<KeywordFacet query={EMPTY_QUERY} />);

    fireEvent.change(screen.getByLabelText("Keywords"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(push).toHaveBeenCalledWith("/jobs", { scroll: false });
  });

  it("removes a chip through the URL, keeping the others", () => {
    render(<KeywordFacet query={{ ...EMPTY_QUERY, keywords: ["design", "senior"] }} />);

    fireEvent.click(screen.getByRole("button", { name: "Remove keyword: design" }));

    expect(push).toHaveBeenCalledWith("/jobs?q=senior", { scroll: false });
  });

  it("renders one chip per active keyword", () => {
    render(<KeywordFacet query={{ ...EMPTY_QUERY, keywords: ["design", "senior"] }} />);

    expect(screen.getAllByRole("button", { name: /Remove keyword:/ })).toHaveLength(2);
  });

  it("renders no chip list when there are no keywords", () => {
    render(<KeywordFacet query={EMPTY_QUERY} />);

    expect(screen.queryByRole("button", { name: /Remove keyword:/ })).toBeNull();
  });
});
