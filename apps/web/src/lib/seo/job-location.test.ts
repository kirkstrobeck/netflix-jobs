import { describe, expect, it } from "vitest";

import { lookupCountry } from "@/lib/seo/countries";
import { parseJobLocation } from "@/lib/seo/job-location";

describe("lookupCountry", () => {
  it("matches case-insensitively across the spellings the board uses", () => {
    expect(lookupCountry("United States of America")?.code).toBe("US");
    expect(lookupCountry("usa")?.code).toBe("US");
    expect(lookupCountry("  Canada  ")?.code).toBe("CA");
  });

  it("returns null rather than a guess for an unknown name", () => {
    expect(lookupCountry("Mu")).toBeNull();
  });
});

describe("parseJobLocation", () => {
  it("reads city, region and country", () => {
    expect(parseJobLocation("Los Gatos,California,United States of America")).toEqual({
      kind: "place",
      address: {
        addressLocality: "Los Gatos",
        addressRegion: "California",
        addressCountry: "US",
      },
    });
  });

  it("reads a two-part city and country", () => {
    expect(parseJobLocation("Vancouver,Canada")).toEqual({
      kind: "place",
      address: { addressLocality: "Vancouver", addressCountry: "CA" },
    });
  });

  // The reason the country is matched across segments instead of taken from the
  // last one: this country name contains the separator.
  it("matches a country whose own name contains a comma", () => {
    expect(parseJobLocation("Seoul,Korea, Republic of")).toEqual({
      kind: "place",
      address: { addressLocality: "Seoul", addressCountry: "KR" },
    });
  });

  it("keeps a bare country as a country", () => {
    expect(parseJobLocation("Singapore")).toEqual({
      kind: "place",
      address: { addressCountry: "SG" },
    });
  });

  it("turns a whole-country remote listing into a Country area", () => {
    expect(parseJobLocation("USA - Remote")).toEqual({
      kind: "area",
      type: "Country",
      name: "USA",
    });
  });

  it("turns a region-scoped remote listing into a State area", () => {
    expect(parseJobLocation("California - Remote,United States of America")).toEqual({
      kind: "area",
      type: "State",
      name: "California, USA",
    });
  });

  it("returns null for a region-scoped remote listing with no country behind it", () => {
    expect(parseJobLocation("Wessex - Remote")).toBeNull();
  });

  it("returns null for an unmappable country and for nothing at all", () => {
    expect(parseJobLocation("Atlantis,Mu")).toBeNull();
    expect(parseJobLocation("")).toBeNull();
    expect(parseJobLocation(" , ")).toBeNull();
  });
});
