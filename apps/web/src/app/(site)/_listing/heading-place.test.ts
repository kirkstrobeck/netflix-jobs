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

const place = (query: Partial<JobQuery>, over: Partial<Nearest> = {}) =>
  headingPlace({ ...EMPTY_QUERY, sort: "nearest", ...query }, COUNTRIES, nearest(over));

/**
 * Finest first, and every tier left reads something the visitor can already
 * see: the URL, or their own device. The tier that read the request's IP is
 * gone -- see listing-heading.ts.
 */
describe("which tier the heading gets to speak at", () => {
  it("names the URL's country when the URL has one", () => {
    expect(place({ country: ["JP"] })).toEqual({
      precision: "country",
      code: "JP",
      name: "Japan",
    });
  });

  // A real position beats a country, always.
  it("drops the country the moment a device fix lands", () => {
    expect(place({ country: ["JP"] }, { buckets: {} })).toEqual({
      precision: "device",
      name: null,
    });
  });

  it("says nothing on a newest list, whatever is known", () => {
    expect(place({ sort: "newest", country: ["US"] })).toBeNull();
  });
});

/**
 * The heading only ever repeats an answer the visitor gave. Where they gave
 * none, or gave more than one, it says nothing rather than picking for them.
 */
describe("when the heading keeps quiet", () => {
  it("keeps quiet when two countries are ticked, which is a list about both", () => {
    expect(place({ country: ["US", "JP"] })).toBeNull();
  });

  it("keeps quiet when the URL names no country at all", () => {
    expect(place({ country: [] })).toBeNull();
  });

  it("keeps quiet when an office is ticked without its country", () => {
    expect(place({ country: [], site: ["us-los-gatos"] })).toBeNull();
  });

  /**
   * The fail-closed path. The facet list only names countries this board hires
   * in, so a code with no label here has nothing to be called -- and the
   * heading stays plain rather than naming a country the visitor would then
   * find zero roles in.
   */
  it("keeps quiet about a country this board does not hire in", () => {
    expect(place({ country: ["KE"] })).toBeNull();
  });
});
