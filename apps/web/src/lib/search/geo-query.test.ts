import { describe, expect, it } from "vitest";

import { countryChosen, toggleCountry, toggleSite } from "@/lib/search/geo-query";
import { EMPTY_QUERY, type JobQuery } from "@/lib/search/job-query";
import { withPage } from "@/lib/search/query-edits";

describe("countryChosen", () => {
  it("is true only when the URL names a country", () => {
    expect(countryChosen(EMPTY_QUERY)).toBe(false);
    expect(countryChosen({ ...EMPTY_QUERY, country: ["US"] })).toBe(true);
  });
});

describe("toggleCountry", () => {
  it("ticks a country and unticks it again", () => {
    const on = toggleCountry(EMPTY_QUERY, "US");

    expect(on.country).toEqual(["US"]);
    expect(toggleCountry(on, "US").country).toEqual([]);
  });

  /**
   * Unticking the last country is a visitor asking for everywhere, and the
   * query it produces is indistinguishable from a first load -- deliberately,
   * because "everywhere" has no spelling in the URL any more. What stops the
   * next load filling the country back in from the request is the cookie, which
   * useCountryChoice writes on the same click. See use-country-choice.test.tsx.
   */
  it("leaves nothing behind when the last country comes off", () => {
    const on = toggleCountry(EMPTY_QUERY, "US");

    expect(toggleCountry(on, "US")).toMatchObject({ country: [], site: [] });
    expect(countryChosen(toggleCountry(on, "US"))).toBe(false);
  });

  it("takes the country's own offices off with it", () => {
    const query: JobQuery = {
      ...EMPTY_QUERY,
      country: ["JP", "US"],
      site: ["jp-tokyo", "us-los-gatos"],
    };

    expect(toggleCountry(query, "US", ["us-los-gatos", "us-remote"])).toMatchObject({
      country: ["JP"],
      site: ["jp-tokyo"],
    });
  });

  it("leaves the offices alone when the country is being ticked ON", () => {
    const query: JobQuery = { ...EMPTY_QUERY, country: ["JP"], site: ["jp-tokyo"] };

    expect(toggleCountry(query, "US", ["us-remote"]).site).toEqual(["jp-tokyo"]);
  });

  it("returns to page 1", () => {
    expect(toggleCountry(withPage(EMPTY_QUERY, 7), "US").page).toBe(1);
  });
});

describe("toggleSite", () => {
  // A site is a refinement of a country, never a filter on its own, so ticking
  // one has to leave a state the panel can actually draw.
  it("ticks the country the office belongs to", () => {
    expect(toggleSite(EMPTY_QUERY, "jp-tokyo", "JP")).toMatchObject({
      country: ["JP"],
      site: ["jp-tokyo"],
    });
  });

  it("does not tick a country that is already on", () => {
    const query = toggleSite(EMPTY_QUERY, "us-los-gatos", "US");

    expect(toggleSite(query, "us-remote", "US").country).toEqual(["US"]);
  });

  it("unticks an office without touching its country", () => {
    const query = toggleSite(EMPTY_QUERY, "jp-tokyo", "JP");

    expect(toggleSite(query, "jp-tokyo", "JP")).toMatchObject({
      country: ["JP"],
      site: [],
    });
  });

  it("returns to page 1 either way", () => {
    const on = toggleSite(withPage(EMPTY_QUERY, 7), "jp-tokyo", "JP");

    expect(on.page).toBe(1);
    expect(toggleSite(withPage(on, 4), "jp-tokyo", "JP").page).toBe(1);
  });
});

