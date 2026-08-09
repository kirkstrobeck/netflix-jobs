import { describe, expect, it, vi } from "vitest";

import { headingPlace } from "@/app/(site)/_listing/heading-place";
import type { Nearest } from "@/app/(site)/_listing/use-nearest";
import type { FacetOption } from "@/lib/search/facet-counts";
import { EMPTY_QUERY, type JobQuery } from "@/lib/search/job-query";

const COUNTRIES: FacetOption[] = [
  { value: "US", label: "United States", count: 303, selected: false },
  { value: "JP", label: "Japan", count: 6, selected: false },
];

const nearest = (over: Partial<Nearest> = {}): Nearest => ({
  status: "idle",
  buckets: null,
  accuracyM: null,
  place: null,
  permission: "prompt",
  request: vi.fn(),
  ...over,
});

const place = (query: Partial<JobQuery>, where: string | null, over: Partial<Nearest> = {}) =>
  headingPlace(
    { ...EMPTY_QUERY, sort: "nearest", ...query },
    COUNTRIES,
    nearest(over),
    where,
  );

/**
 * Finest first, and the split that matters most is the last one: a country in
 * the URL is a FILTER, and a country from the request is a GUESS. They are
 * different tiers because they are different claims -- see listing-heading.ts.
 */
describe("which tier the heading gets to speak at", () => {
  it("uses the URL's country and never the guess, when the URL has one", () => {
    expect(place({ country: ["JP"] }, "US")).toEqual({
      precision: "country",
      code: "JP",
      name: "Japan",
    });
  });

  it("falls to the request's country when the visitor cleared the filter", () => {
    expect(place({ country: [] }, "US")).toEqual({
      precision: "request",
      code: "US",
      name: "United States",
    });
  });

  // A real position beats both, always.
  it("drops the guess the moment a device fix lands", () => {
    expect(place({ country: [] }, "US", { buckets: {} })).toEqual({
      precision: "device",
      name: null,
    });
  });

  it("says nothing on a newest list, whatever is known", () => {
    expect(place({ sort: "newest", country: [] }, "US")).toBeNull();
  });
});

/**
 * The guess is only ever allowed to fill a silence. Anywhere the visitor has
 * answered the question themselves, it stays out -- naming a country beside a
 * list they have already scoped is the heading talking over them.
 */
describe("when the guess keeps quiet", () => {
  it("keeps quiet when two countries are ticked, as the filter tier does", () => {
    expect(place({ country: ["US", "JP"] }, "US")).toBeNull();
  });

  it("keeps quiet when an office answers the question instead", () => {
    expect(place({ country: [], site: ["us-los-gatos"] }, "US")).toBeNull();
  });

  it("keeps quiet when the route said nothing", () => {
    expect(place({ country: [] }, null)).toBeNull();
  });

  /**
   * The fail-closed path. The facet list only names countries this board hires
   * in, so a request placed somewhere with no roles has no label here -- and
   * the heading stays plain rather than naming a country the visitor would then
   * find zero roles in.
   */
  it("keeps quiet about a country this board does not hire in", () => {
    expect(place({ country: [] }, "KE")).toBeNull();
  });
});
