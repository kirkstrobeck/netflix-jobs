import { describe, expect, it } from "vitest";

import {
  countryChosen,
  everyCountry,
  toggleCountry,
  toggleSite,
} from "@/lib/search/geo-query";
import { EMPTY_QUERY, withPage, type JobQuery } from "@/lib/search/job-query";

describe("countryChosen", () => {
  it("is false only when the URL has not answered", () => {
    expect(countryChosen(EMPTY_QUERY)).toBe(false);
    expect(countryChosen({ ...EMPTY_QUERY, country: ["US"] })).toBe(true);
    expect(countryChosen({ ...EMPTY_QUERY, everywhere: true })).toBe(true);
  });
});

describe("toggleCountry", () => {
  it("ticks a country and unticks it again", () => {
    const on = toggleCountry(EMPTY_QUERY, "US");

    expect(on.country).toEqual(["US"]);
    expect(toggleCountry(on, "US").country).toEqual([]);
  });

  /**
   * The heart of "detection must never fight the user". Clearing the last
   * country leaves a listing that looks exactly like a first load, and if it
   * WERE a first load the country would be filled back in from the request --
   * so the state has to record that the visitor cleared it on purpose.
   */
  it("turns unticking the last country into an explicit everywhere", () => {
    const on = toggleCountry(EMPTY_QUERY, "US");

    expect(toggleCountry(on, "US").everywhere).toBe(true);
    expect(countryChosen(toggleCountry(on, "US"))).toBe(true);
  });

  it("stops being everywhere as soon as a country is ticked", () => {
    expect(toggleCountry(everyCountry(EMPTY_QUERY), "JP")).toMatchObject({
      country: ["JP"],
      everywhere: false,
    });
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
      everywhere: false,
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

describe("everyCountry", () => {
  it("clears both levels and says so", () => {
    const query: JobQuery = { ...EMPTY_QUERY, country: ["US"], site: ["us-remote"] };

    expect(everyCountry(query)).toMatchObject({
      country: [],
      site: [],
      everywhere: true,
      page: 1,
    });
  });
});
