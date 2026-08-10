import { describe, expect, it } from "vitest";

import { listingHeading } from "@/lib/search/listing-heading";

/**
 * The heading carries the sort, so the thing worth pinning is that its grammar
 * never overstates the precision it was built from -- and, since the country
 * callout was removed, that it never names a country again.
 */
describe("listingHeading", () => {
  it("states the order on a newest list, whatever place is known", () => {
    expect(listingHeading("newest", null)).toBe("Newest open roles");
    expect(listingHeading("newest", { precision: "country", code: "JP", name: "Japan" })).toBe(
      "Newest open roles",
    );
  });

  it("says nearest to a place only once there is a real position", () => {
    expect(
      listingHeading("nearest", { precision: "device", name: "Beaverton, Oregon" }),
    ).toBe("Open roles nearest to Beaverton, Oregon");
  });

  // No geocoder is configured, so a device fix has no name. "you" is true and
  // claims exactly what a position tells us; inventing a city would not be.
  it("falls back to you rather than naming a place it cannot name", () => {
    expect(listingHeading("nearest", { precision: "device", name: null })).toBe(
      "Open roles nearest to you",
    );
  });

  it("claims nothing when nearest is asked for and nowhere is known", () => {
    expect(listingHeading("nearest", null)).toBe("Open roles");
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
 * These tests are the regression: the tiers still exist, because LocationOffer
 * reads them, so a future edit could quietly teach one of them to speak again.
 */
describe("the country the heading no longer names", () => {
  const ticked = { precision: "country", code: "US", name: "United States" } as const;
  const guessed = { precision: "request", code: "US", name: "United States" } as const;

  it("says a bare Open roles for a country the visitor ticked", () => {
    expect(listingHeading("nearest", ticked)).toBe("Open roles");
  });

  it("says a bare Open roles for a country read off the request", () => {
    expect(listingHeading("nearest", guessed)).toBe("Open roles");
  });

  // Both old sentences at once, including the article the country tier used to
  // add for four of the board's twenty-two countries.
  it("names no country in any tier, with or without its article", () => {
    const every = [
      listingHeading("nearest", ticked),
      listingHeading("nearest", guessed),
      listingHeading("nearest", { precision: "country", code: "JP", name: "Japan" }),
      listingHeading("nearest", { precision: "request", code: "GB", name: "United Kingdom" }),
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
