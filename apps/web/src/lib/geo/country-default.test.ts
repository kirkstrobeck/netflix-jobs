import { afterEach, describe, expect, it } from "vitest";

import { countryDefault } from "@/lib/geo/country-default";

/**
 * The precedence table, at the seam it now lives at.
 *
 * These cases used to be asserted against a rendered listing, because the
 * country was applied during the render. It is decided before the render now,
 * so they are asserted against the decision: which country, if any, this
 * request is owed.
 *
 * URL beats cookie beats geo header. The URL is not an argument here -- the
 * caller checks it first, because a URL that has answered is owed nothing --
 * so what is pinned below is the other two, and the four ways of being owed
 * nothing at all.
 */

afterEach(() => {
  delete process.env.DEV_GEO_COUNTRY;
});

describe("the country a request is owed", () => {
  it("takes the country the edge read off the address", () => {
    expect(countryDefault(undefined, "JP")).toEqual(["JP"]);
  });

  // Vercel's header is the production path; DEV_GEO_COUNTRY is the localhost
  // one, and the header outranks it so a real deployment is never overridden
  // by a stray env var that followed the build in.
  it("prefers the header over the dev override", () => {
    process.env.DEV_GEO_COUNTRY = "US";

    expect(countryDefault(undefined, "JP")).toEqual(["JP"]);
  });

  // The localhost path, and the reason any of this is reachable without an
  // edge in front of it: there is no header under `next dev`, ever.
  it("falls back to the dev override when there is no edge in front", () => {
    process.env.DEV_GEO_COUNTRY = "JP";

    expect(countryDefault(undefined, null)).toEqual(["JP"]);
  });

  it("assumes the United States when nothing says otherwise", () => {
    expect(countryDefault(undefined, null)).toEqual(["US"]);
  });

  // An override that is not a country code at all stands in for an edge that
  // could not place the address -- the third case, and the one that is
  // otherwise unreachable by hand.
  it("is owed nothing when the address could not be placed", () => {
    process.env.DEV_GEO_COUNTRY = "none";

    expect(countryDefault(undefined, null)).toEqual([]);
  });

  it("prefers a remembered choice over the address", () => {
    expect(countryDefault("US", "JP")).toEqual(["US"]);
  });

  /**
   * A remembered "every country" is a choice too -- the one a visitor makes by
   * unticking their last country -- and it has to stop the header cold. It
   * comes back as nothing owed, which is the same answer as "no signal": both
   * end at an unfiltered listing on an unfiltered URL, so they are one value
   * rather than a flag nobody reads.
   */
  it("honours a remembered everywhere over the address", () => {
    expect(countryDefault("all", "JP")).toEqual([]);
  });

  /**
   * A visitor in Kenya has their address read perfectly and would land on a
   * listing of zero roles, which reads as a broken board rather than as a
   * filter. A detected country this board does not hire in is dropped.
   */
  it("drops a detected country the board does not hire in", () => {
    expect(countryDefault(undefined, "KE")).toEqual([]);
  });

  // A remembered country is NOT checked that way: they chose it, and a country
  // they chose with nothing open this week is a fact they are entitled to see.
  it("keeps a remembered country the board does not hire in", () => {
    expect(countryDefault("KE", "JP")).toEqual(["KE"]);
  });

  // A cookie nobody can read is not a choice. It falls through to the address
  // rather than filtering the board to something that is not a country.
  it("falls through to the address when the cookie is junk", () => {
    expect(countryDefault("not-a-country", "JP")).toEqual(["JP"]);
  });
});
