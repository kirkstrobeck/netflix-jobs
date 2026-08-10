import { describe, expect, it } from "vitest";

import { siteCatalog } from "@/lib/jobs/board";
import { JOBS, SITES, summary } from "@/lib/jobs/job-summary.fixture";
import { facetOptions, matchOptions } from "@/lib/search/facet-counts";
import { toggleCountry } from "@/lib/search/geo-query";
import { EMPTY_QUERY, toggleFacet, type JobQuery } from "@/lib/search/job-query";

const catalog = siteCatalog(SITES);
const counts = (options: { value: string; count: number }[]) =>
  Object.fromEntries(options.map((option) => [option.value, option.count]));
const options = (query: JobQuery, key: Parameters<typeof facetOptions>[2]) =>
  facetOptions(JOBS, query, key, catalog);

describe("facetOptions", () => {
  it("counts every value in the facet when nothing is selected", () => {
    expect(counts(options(EMPTY_QUERY, "team"))).toEqual({
      Engineering: 3,
      Marketing: 2,
    });
    expect(counts(options(EMPTY_QUERY, "workType"))).toEqual({
      Onsite: 3,
      Remote: 2,
    });
  });

  // A posting open in several offices counts once against each of them, so the
  // site counts sum to more than the number of jobs. That is correct.
  it("counts a multi-site job under each of its offices", () => {
    expect(counts(options(EMPTY_QUERY, "site"))).toEqual({
      "us-los-gatos": 2,
      "us-remote": 2,
      "jp-tokyo": 1,
      "us-new-york": 1,
    });
  });

  /**
   * The country is the level users actually ask at, and it has to answer "how
   * many roles are in the US" with the number of ROLES. The Brand designer is
   * posted in New York and as US-remote; counting it the way the site facet
   * does would make the United States say five over a board of four.
   */
  it("counts a job once per country, however many offices it has there", () => {
    expect(counts(options(EMPTY_QUERY, "country"))).toEqual({ US: 4, JP: 1 });
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

  // The whole point of counting with the facet's own selections dropped: after
  // ticking Engineering, Marketing must still show what adding it would bring.
  it("keeps its own options countable once one is selected", () => {
    const query = toggleFacet(EMPTY_QUERY, "team", "Engineering");
    const teams = options(query, "team");

    expect(counts(teams)).toEqual({ Engineering: 3, Marketing: 2 });
    expect(teams.find((o) => o.value === "Engineering")?.selected).toBe(true);
    expect(teams.find((o) => o.value === "Marketing")?.selected).toBe(false);
  });

  // The same rule, one level down: with the United States ticked, Japan still
  // has to show what ticking it would ADD rather than a zero.
  it("keeps the other countries countable once one is ticked", () => {
    expect(counts(options(toggleCountry(EMPTY_QUERY, "US"), "country"))).toEqual({
      US: 4,
      JP: 1,
    });
  });

  // The offices, by contrast, are counted INSIDE the ticked country -- that is
  // what makes the number under United States a preview of what is on screen.
  it("counts the offices within the country that is ticked", () => {
    expect(counts(options(toggleCountry(EMPTY_QUERY, "US"), "site"))).toEqual({
      "us-los-gatos": 2,
      "us-remote": 2,
      "us-new-york": 1,
    });
  });

  // Every OTHER facet still applies, which is what makes the number a real
  // preview of the result set rather than a board-wide total.
  it("narrows a facet by the other facets' selections", () => {
    const query = toggleFacet(EMPTY_QUERY, "workType", "Remote");

    expect(counts(options(query, "team"))).toEqual({
      Engineering: 1,
      Marketing: 1,
    });
  });

  it("narrows a facet by the active keywords", () => {
    const query: JobQuery = { ...EMPTY_QUERY, keywords: ["designer"] };

    expect(counts(options(query, "team"))).toEqual({ Marketing: 1 });
  });

  // Otherwise the only control that could clear the filter would disappear and
  // the visitor would be stuck with an empty list.
  it("keeps a selected option visible at zero", () => {
    const jobs = [...JOBS, summary({ team: "Legal", work_type: "Onsite" })];
    const query = toggleFacet(
      toggleFacet(EMPTY_QUERY, "team", "Legal"),
      "workType",
      "Remote",
    );

    expect(
      facetOptions(jobs, query, "team", catalog).find((o) => o.value === "Legal"),
    ).toMatchObject({ count: 0, selected: true });
  });

  it("returns nothing for a facet no job carries a value for", () => {
    const jobs = [summary({ team: null }), summary({ team: null })];

    expect(facetOptions(jobs, EMPTY_QUERY, "team", catalog)).toEqual([]);
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
