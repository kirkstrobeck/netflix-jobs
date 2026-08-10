import { describe, expect, it } from "vitest";

import { siteCatalog } from "@/lib/jobs/board";
import { JOBS, SITES, summary } from "@/lib/jobs/job-summary.fixture";
import { facetOptions, matchOptions } from "@/lib/search/facet-counts";
import { EMPTY_QUERY, type JobQuery } from "@/lib/search/job-query";

// What an option SAYS and where it sits: the readable name, the country it
// nests under, the order the list comes back in, and the search that matches on
// all of it. The numbers themselves are facet-counts.test.ts -- an option can
// be counted right and named wrong, and the two failures read nothing alike.

const catalog = siteCatalog(SITES);
const options = (query: JobQuery, key: Parameters<typeof facetOptions>[2]) =>
  facetOptions(JOBS, query, key, catalog);

describe("the name on an option", () => {
  // The URL carries the slug; the panel shows the label. Both are written in
  // seniority.ts so the two cannot drift.
  it("labels a seniority slug with its name, in sentence case", () => {
    const staff = options(EMPTY_QUERY, "seniority").find((o) => o.value === "staff");

    expect(staff?.label).toBe("Staff and principal");
  });

  // Same answer as an unknown country code: the option renders as itself so the
  // box that a hand-typed `?level=` ticked is a box that can be unticked.
  it("labels an unknown seniority slug with the slug", () => {
    const option = facetOptions(
      JOBS,
      { ...EMPTY_QUERY, seniority: ["archmage"] },
      "seniority",
      catalog,
    ).find((entry) => entry.value === "archmage");

    expect(option).toMatchObject({ label: "archmage", count: 0, selected: true });
  });

  it("labels a country by name and an office by its name within it", () => {
    const us = options(EMPTY_QUERY, "country").find((o) => o.value === "US");
    const losGatos = options(EMPTY_QUERY, "site").find(
      (o) => o.value === "us-los-gatos",
    );

    expect(us?.label).toBe("United States");
    // Not "Los Gatos, California, United States": the option is only ever drawn
    // nested under the country that was ticked to reveal it.
    expect(losGatos?.label).toBe("Los Gatos, California");
  });

  // Which country an office belongs to travels ON the option, so the panel can
  // draw the nested tree without carrying the site catalog down beside it.
  it("groups each site option under its country code", () => {
    const sites = options(EMPTY_QUERY, "site");

    expect(sites.find((o) => o.value === "jp-tokyo")?.group).toBe("JP");
    expect(sites.find((o) => o.value === "us-remote")?.group).toBe("US");
  });

  /**
   * A slug with no row in the catalog. The foreign key on job_locations makes
   * it impossible from the database, so this only fires if a board and a site
   * table were somehow paired across a crawl -- and an option labelled with
   * its slug is a worse row than the others, but a readable one. "undefined"
   * is not.
   */
  it("labels an unknown slug with the slug, and groups it nowhere", () => {
    const jobs = [summary({ sites: ["xx-atlantis"] })];
    const [option] = facetOptions(jobs, EMPTY_QUERY, "site", catalog);

    expect(option).toBeUndefined();
    expect(
      facetOptions(
        jobs,
        { ...EMPTY_QUERY, site: ["xx-atlantis"] },
        "site",
        catalog,
      )[0],
    ).toMatchObject({ label: "xx-atlantis", group: undefined, count: 0 });
  });

  it("leaves a country option ungrouped -- it is the top level", () => {
    expect(options(EMPTY_QUERY, "country").every((o) => o.group === undefined)).toBe(
      true,
    );
  });

  it("sorts by count, then by label for ties", () => {
    const labels = options(EMPTY_QUERY, "site").map((o) => o.label);

    expect(labels.slice(2)).toEqual(["New York", "Tokyo"]);
  });
});

describe("matchOptions", () => {
  const countries = facetOptions(JOBS, EMPTY_QUERY, "country", catalog);

  it("returns everything for a blank search", () => {
    expect(matchOptions(countries, "")).toHaveLength(2);
    expect(matchOptions(countries, "   ")).toHaveLength(2);
  });

  it("matches the readable label, case-insensitively", () => {
    expect(matchOptions(countries, "japan").map((o) => o.value)).toEqual(["JP"]);
    expect(matchOptions(countries, "united states")).toHaveLength(1);
  });

  // Somebody who thinks in codes types JP, and the label does not contain it.
  it("also matches the stored value", () => {
    expect(matchOptions(countries, "jp").map((o) => o.value)).toEqual(["JP"]);
  });

  it("returns nothing when no option matches", () => {
    expect(matchOptions(countries, "atlantis")).toEqual([]);
  });
});
