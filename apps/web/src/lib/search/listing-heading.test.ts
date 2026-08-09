import { describe, expect, it } from "vitest";

import { headingParts, listingHeading } from "@/lib/search/listing-heading";

/**
 * The heading carries the sort and the place, so the thing worth pinning is that
 * its grammar never overstates the precision it was built from.
 */
describe("listingHeading", () => {
  it("states the order on a newest list, whatever place is known", () => {
    expect(listingHeading("newest", null)).toBe("Newest open roles");
    expect(listingHeading("newest", { precision: "country", code: "JP", name: "Japan" })).toBe(
      "Newest open roles",
    );
  });

  // The whole point of tiered wording. A country is not a point, so nothing can
  // be "nearest to" it, and a single template across all three tiers produces
  // exactly that sentence.
  it("states a country as a country, never as somewhere to be near", () => {
    const heading = listingHeading("nearest", {
      precision: "country",
      code: "US",
      name: "United States",
    });

    expect(heading).toBe("Open roles in the United States");
    expect(heading).not.toContain("nearest to");
  });

  // Four of the board's twenty-two countries take a definite article and the
  // rest do not, so one template cannot cover both.
  it("gives a country its article, and only where one belongs", () => {
    const of = (code: string, name: string) =>
      listingHeading("nearest", { precision: "country", code, name });

    expect(of("GB", "United Kingdom")).toBe("Open roles in the United Kingdom");
    expect(of("NL", "Netherlands")).toBe("Open roles in the Netherlands");
    expect(of("PH", "Philippines")).toBe("Open roles in the Philippines");
    expect(of("JP", "Japan")).toBe("Open roles in Japan");
    expect(of("BR", "Brazil")).toBe("Open roles in Brazil");
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
 * THE TIER THAT MUST NOT SOUND LIKE A FILTER.
 *
 * `request` is the country the edge read off the request, for a visitor who has
 * cleared the country filter. Their list is every open role on the board, so
 * "Open roles in the United States" would be a phantom filter -- worse than an
 * invisible one, because they can read it and believe it.
 */
describe("the country we merely guessed", () => {
  const guess = { precision: "request", code: "US", name: "United States" } as const;

  it("names who is in the country, and claims nothing about the list", () => {
    const heading = listingHeading("nearest", guess);

    expect(heading).toBe("Open roles — you are in the United States");
    expect(heading).not.toContain("Open roles in");
    expect(heading).not.toContain("nearest to");
  });

  it("takes the same article rule as every other tier", () => {
    expect(
      listingHeading("nearest", { precision: "request", code: "JP", name: "Japan" }),
    ).toBe("Open roles — you are in Japan");
  });

  /**
   * The clause is a separate run because it arrives AFTER paint and, on a
   * narrow screen, would take this label from one line to three -- moving the
   * whole list down. Splitting it is what lets the stylesheet drop it there.
   * The lead is never repeated inside it, so a missing stylesheet shows the
   * long sentence rather than "Open roles" twice.
   */
  it("splits the clause off so the stylesheet can drop it, without repeating the lead", () => {
    const parts = headingParts("nearest", guess);

    expect(parts.lead).toBe("Open roles");
    expect(parts.where).toBe(" — you are in the United States");
    expect(`${parts.lead}${parts.where}`).toBe(listingHeading("nearest", guess));
  });

  it("leaves every other tier in one piece", () => {
    expect(headingParts("newest", null)).toEqual({
      lead: "Newest open roles",
      where: null,
    });
    expect(headingParts("nearest", { precision: "device", name: null })).toEqual({
      lead: "Open roles nearest to you",
      where: null,
    });
  });
});
