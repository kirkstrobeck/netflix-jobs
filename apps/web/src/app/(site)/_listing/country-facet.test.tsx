import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CountryFacet } from "@/app/(site)/_listing/country-facet";
import { NavigateProvider } from "@/app/(site)/_listing/use-query-navigation";
import { BOARD } from "@/lib/jobs/job-summary.fixture";
import { toggleCountry, type CountryDefault } from "@/lib/search/geo-query";
import { EMPTY_QUERY, jobsHref, type JobQuery } from "@/lib/search/job-query";
import { deriveListing } from "@/lib/search/listing-view";

const navigate = vi.fn();
const NO_DEFAULT: CountryDefault = { countries: [], from: "detected" };

// Controls hand over a query, not a URL. Reading it back as a URL is still the
// clearest way to state the expectation, and it is the same serialiser the
// address bar gets.
const navigatedTo = () => jobsHref(navigate.mock.calls.at(-1)![0]);

const mount = (ui: ReactNode) =>
  render(<NavigateProvider value={navigate}>{ui}</NavigateProvider>);

function facet(query: JobQuery = EMPTY_QUERY, countryDefault = NO_DEFAULT) {
  const { facets } = deriveListing(BOARD, query);

  return mount(
    <CountryFacet
      countries={facets.country}
      countryDefault={countryDefault}
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

/**
 * A listing that quietly drops from five roles to four because the request came
 * from California is indistinguishable from a board that only has four. The
 * note is what tells the difference, and the link beside it is the undo --
 * which, being a link to `?country=all`, also stops detection ever applying
 * again on that URL.
 */
describe("the note about a detected country", () => {
  const detected: CountryDefault = { countries: ["US"], from: "detected" };

  it("names the country and offers the way out", () => {
    facet({ ...EMPTY_QUERY, country: ["US"] }, detected);

    expect(screen.getByText(/United States was matched to your location/)).toBeTruthy();

    fireEvent.click(screen.getByRole("link", { name: "Show every country" }));

    expect(navigatedTo()).toBe("/?country=all");
  });

  it("stays quiet once the selection is no longer just the detected country", () => {
    facet({ ...EMPTY_QUERY, country: ["JP", "US"] }, detected);

    expect(screen.queryByText(/matched to your location/)).toBeNull();
  });

  // The same rule the other way round: one country ticked, but not the one
  // that was detected. They have answered, so there is nothing to explain.
  it("stays quiet when the one ticked country is not the detected one", () => {
    facet({ ...EMPTY_QUERY, country: ["JP"] }, detected);

    expect(screen.queryByText(/matched to your location/)).toBeNull();
  });

  it("stays quiet for a country the visitor chose on an earlier visit", () => {
    facet({ ...EMPTY_QUERY, country: ["US"] }, { countries: ["US"], from: "remembered" });

    expect(screen.queryByText(/matched to your location/)).toBeNull();
  });

  /**
   * A code with no option to read a name off still has to say something.
   * facetOptions pins a selected country into the list even at a count of
   * zero, so this cannot arrive from deriveListing -- the props are built by
   * hand here for that reason. "KE was matched to your location" is a poor
   * sentence and a readable one; a blank where the country's name goes is
   * neither.
   */
  it("falls back to the code when the country has no option to name it", () => {
    mount(
      <CountryFacet
        countries={[]}
        countryDefault={{ countries: ["KE"], from: "detected" }}
        query={{ ...EMPTY_QUERY, country: ["KE"] }}
        sites={[]}
      />,
    );

    expect(screen.getByText(/KE was matched to your location/)).toBeTruthy();
  });
});
