import { describe, expect, it } from "vitest";

import { listingHeading } from "@/lib/search/listing-heading";

/**
 * The heading does not carry the sort, so what is worth pinning is the absence
 * of the prefix -- and that its grammar never overstates the precision it was
 * built from, nor names a country again.
 */
describe("listingHeading", () => {
  it("says a bare Open roles when nowhere is known", () => {
    expect(listingHeading(null)).toBe("Open roles");
  });

  it("says nearest to a place only once there is a real position", () => {
    expect(listingHeading({ precision: "device", name: "Beaverton, Oregon" })).toBe(
      "Open roles nearest to Beaverton, Oregon",
    );
  });

  // No geocoder is configured, so a device fix has no name. "you" is true and
  // claims exactly what a position tells us; inventing a city would not be.
  it("falls back to you rather than naming a place it cannot name", () => {
    expect(listingHeading({ precision: "device", name: null })).toBe(
      "Open roles nearest to you",
    );
  });
});

/**
 * THE SORT PREFIX THAT WAS REMOVED, PINNED SO IT CANNOT COME BACK.
 *
 * "Newest open roles" was the heading of every unsorted first load, which is to
 * say of the default board. It is gone, and the strongest guarantee available is
 * structural: `sort` is not an argument any more, so there is no value anyone can
 * pass that reintroduces a prefix. These assertions are the behavioural half --
 * every heading this function can produce, checked for the word.
 */
describe("the sort the heading no longer states", () => {
  const every = [
    listingHeading(null),
    listingHeading({ precision: "country", code: "US", name: "United States" }),
    listingHeading({ precision: "device", name: null }),
    listingHeading({ precision: "device", name: "Beaverton, Oregon" }),
  ];

  it("never says Newest, in any state", () => {
    for (const heading of every) {
      expect(heading).not.toContain("Newest");
      expect(heading).not.toContain("newest");
    }
  });

  // Not just the newest wording: no heading is allowed to OPEN with anything but
  // the two words the column is called. A future sort mode adding "Closest open
  // roles" or "Relevant open roles" fails here.
  it("opens with Open roles, whatever else it goes on to say", () => {
    for (const heading of every) {
      expect(heading.startsWith("Open roles")).toBe(true);
    }
  });

  // The one argument it does take cannot be a sort mode by construction, so the
  // signature itself is the regression. This fails to compile if `sort` returns.
  it("takes a place and nothing else", () => {
    expect(listingHeading).toHaveLength(1);
  });
});

/**
 * THE CALLOUT THAT WAS REMOVED, PINNED SO IT CANNOT COME BACK.
 *
 * The heading used to name the visitor's country in two different sentences:
 * "Open roles in the United States" for a ticked country, and "Open roles — you
 * are in the United States" for one the edge merely read off the request. Both
 * are gone. The board redirects to a country and filters by it, and the facets
 * panel is on screen with that country ticked, so the heading was restating a
 * filter the visitor can already see.
 *
 * The request tier went further and no longer exists at all -- with nothing
 * left to say, the hook and the route feeding it were a round trip that moved
 * no pixel. The country tier does still exist, because LocationOffer reads it,
 * so a future edit could quietly teach it to speak again. These tests are the
 * regression for the half that survives.
 */
describe("the country the heading no longer names", () => {
  const ticked = { precision: "country", code: "US", name: "United States" } as const;

  it("says a bare Open roles for a country the visitor ticked", () => {
    expect(listingHeading(ticked)).toBe("Open roles");
  });

  it("says a bare Open roles when nowhere is known at all", () => {
    expect(listingHeading(null)).toBe("Open roles");
  });

  // Both old sentences at once, including the article the country tier used to
  // add for four of the board's twenty-two countries.
  it("names no country, with or without its article", () => {
    const every = [
      listingHeading(ticked),
      listingHeading(null),
      listingHeading({ precision: "country", code: "JP", name: "Japan" }),
      listingHeading({ precision: "country", code: "GB", name: "United Kingdom" }),
    ];

    for (const heading of every) {
      expect(heading).toBe("Open roles");
      expect(heading).not.toContain("United States");
      expect(heading).not.toContain("United Kingdom");
      expect(heading).not.toContain("Japan");
      expect(heading).not.toContain("you are in");
    }
  });
});
