import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CountryFacet } from "@/app/(site)/_listing/country-facet";
import { NavigateProvider } from "@/app/(site)/_listing/use-query-navigation";
import { BOARD } from "@/lib/jobs/job-summary.fixture";
import { toggleCountry } from "@/lib/search/geo-query";
import { EMPTY_QUERY, jobsHref, type JobQuery } from "@/lib/search/job-query";
import { deriveListing } from "@/lib/search/listing-view";

const navigate = vi.fn();
// Controls hand over a query, not a URL. Reading it back as a URL is still the
// clearest way to state the expectation, and it is the same serialiser the
// address bar gets.
const navigatedTo = () => jobsHref(navigate.mock.calls.at(-1)![0]);

const mount = (ui: ReactNode) =>
  render(<NavigateProvider value={navigate}>{ui}</NavigateProvider>);

function facet(query: JobQuery = EMPTY_QUERY) {
  const { facets } = deriveListing(BOARD, query);

  return mount(
    <CountryFacet
      countries={facets.country}
      query={query}
      sites={facets.site}
    />,
  );
}

const box = (name: RegExp) =>
  screen.getByRole("checkbox", { name }) as HTMLInputElement;

const offices = () => screen.queryByRole("list", { name: /^Places in/ });

beforeEach(() => navigate.mockClear());
afterEach(cleanup);

// The complaint this whole facet exists to answer: "it is weird that I would
// have to select multiple U.S. things". One box for the country, and the
// offices in it only once that box is ticked.
describe("country first", () => {
  it("offers countries, and no offices at all, until one is ticked", () => {
    facet();

    expect(box(/United States/)).toBeTruthy();
    expect(screen.queryByRole("checkbox", { name: /Los Gatos/ })).toBeNull();
    expect(offices()).toBeNull();
  });

  it("means every role in the country, on one click", () => {
    facet();

    fireEvent.click(box(/United States/));

    expect(navigatedTo()).toBe("/?country=US");
  });

  // Unticking the last country is an explicit "everywhere", not a return to
  // the unanswered state -- otherwise the next load would detect over it.
  it("clears to an explicit everywhere rather than to nothing", () => {
    facet(toggleCountry(EMPTY_QUERY, "US"));

    fireEvent.click(box(/United States/));

    expect(navigatedTo()).toBe("/?country=all");
  });
});

describe("the offices under a ticked country", () => {
  const us = toggleCountry(EMPTY_QUERY, "US");

  it("appears once the country is ticked, named for it", () => {
    facet(us);

    expect(offices()?.getAttribute("aria-label")).toBe("Places in United States");
    expect(box(/Los Gatos/)).toBeTruthy();
  });

  // Nested under the country that was ticked to reveal it, so the country is
  // not repeated on every row beneath a heading that already says it.
  it("names each office within its country, with its own count", () => {
    facet(us);

    const list = within(offices()!);
    expect(list.getByText("Los Gatos, California")).toBeTruthy();
    expect(list.getByText("Remote")).toBeTruthy();
    expect(list.getByText("New York")).toBeTruthy();
  });

  it("narrows the country it sits in, keeping the country ticked", () => {
    facet(us);

    fireEvent.click(box(/Los Gatos/));

    expect(navigatedTo()).toBe("/?country=US&site=us-los-gatos");
  });

  it("unticks an office without unticking its country", () => {
    facet({ ...EMPTY_QUERY, country: ["US"], site: ["us-los-gatos"] });

    expect(box(/Los Gatos/).checked).toBe(true);
    fireEvent.click(box(/Los Gatos/));

    expect(navigatedTo()).toBe("/?country=US");
  });

  // A ticked country takes its offices with it: the site controls only exist
  // underneath it, so one left behind would be a filter with no way to clear.
  it("goes away with the country, and takes the selection with it", () => {
    facet({ ...EMPTY_QUERY, country: ["US"], site: ["us-los-gatos"] });

    fireEvent.click(box(/United States/));

    expect(navigatedTo()).toBe("/?country=all");
  });

  /**
   * An office list of one repeats the country's own count on a checkbox that
   * cannot narrow anything. Seventeen of the 21 real countries are in that
   * position; Japan is the fixture's.
   */
  it("is not drawn for a country with only one office", () => {
    facet(toggleCountry(EMPTY_QUERY, "JP"));

    expect(box(/Japan/).checked).toBe(true);
    expect(offices()).toBeNull();
  });
});
