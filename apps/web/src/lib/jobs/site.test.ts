import { describe, expect, it } from "vitest";

import { siteLabel, type Site } from "@/lib/jobs/site";

const site = (overrides: Partial<Site>): Site => ({
  slug: "us-los-gatos",
  city: "Los Gatos",
  region: "California",
  country_code: "US",
  country: "United States",
  is_remote: false,
  display_name: "Los Gatos, California, United States",
  ...overrides,
});

describe("siteLabel", () => {
  /**
   * The facet never shows a site on its own -- it is always nested under the
   * country that was ticked to reveal it -- so `display_name` would repeat that
   * country on every row: "Los Gatos, California, United States" under a
   * heading that already says United States, ten times over.
   */
  it("names a place within its country, without repeating the country", () => {
    expect(siteLabel(site({}))).toBe("Los Gatos, California");
  });

  // 'Singapore, Singapore' and 'Mumbai, Mumbai' are what the naive join gives
  // when the region only repeats the city.
  it("does not repeat a region that is just the city again", () => {
    expect(siteLabel(site({ city: "Singapore", region: "Singapore" }))).toBe(
      "Singapore",
    );
  });

  it("is just the city when there is no region", () => {
    expect(siteLabel(site({ city: "Tokyo", region: null }))).toBe("Tokyo");
  });

  // A remote scope reads as what distinguishes it from the offices listed
  // beside it, which is that it is not one of them.
  it("calls a remote scope Remote rather than naming a place", () => {
    const remote = site({
      slug: "us-remote",
      city: null,
      region: null,
      is_remote: true,
    });

    expect(siteLabel(remote)).toBe("Remote");
  });

  it("keeps a remote scope's region, so it does not collapse onto Remote", () => {
    const remote = site({
      slug: "us-california-remote",
      city: null,
      region: "California",
      is_remote: true,
    });

    expect(siteLabel(remote)).toBe("Remote, California");
  });

  // locations_remote_shape_ck forbids a non-remote site without a city, so this
  // cannot arrive from the database -- but the column is nullable for the
  // remote scopes, so the type says it can, and a label is not the place to
  // find out. The slug always distinguishes the row.
  it("falls back to the slug rather than rendering an empty label", () => {
    expect(siteLabel(site({ slug: "xx-nowhere", city: null }))).toBe("xx-nowhere");
  });
});
