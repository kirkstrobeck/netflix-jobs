import { describe, expect, it } from "vitest";

import { siteCatalog } from "@/lib/jobs/board";
import { JOBS, SITES } from "@/lib/jobs/job-summary.fixture";
import { filterJobs } from "@/lib/search/filter-jobs";
import { toggleCountry, toggleSite } from "@/lib/search/geo-query";
import { EMPTY_QUERY, type JobQuery } from "@/lib/search/job-query";

const catalog = siteCatalog(SITES);
const titles = (query: JobQuery, ignore?: Parameters<typeof filterJobs>[3]) =>
  filterJobs(JOBS, query, catalog, ignore)
    .map((job) => job.title)
    .sort();

// The fixture board: four US postings (two in Los Gatos, one US-remote, one in
// New York AND US-remote) and one in Tokyo.
describe("country and site together", () => {
  it("a country on its own means every role in it", () => {
    expect(titles(toggleCountry(EMPTY_QUERY, "US"))).toEqual([
      "Brand designer",
      "Engineering manager, playback",
      "Senior software engineer",
      "Staff software engineer",
    ]);
  });

  // The office controls only exist under a ticked country, so an office left
  // behind when that country is unticked would be a filter with no visible way
  // to clear it.
  it("unticking a country takes its offices with it", () => {
    const query = toggleSite(toggleCountry(EMPTY_QUERY, "US"), "jp-tokyo", "JP");

    expect(query.site).toEqual(["jp-tokyo"]);
    expect(titles(toggleCountry(query, "JP", ["jp-tokyo"]))).toEqual([
      "Brand designer",
      "Engineering manager, playback",
      "Senior software engineer",
      "Staff software engineer",
    ]);
  });

  it("keeps a remote scope inside its own country", () => {
    const query = toggleSite(EMPTY_QUERY, "us-remote", "US");

    expect(titles(query)).toEqual(["Brand designer", "Engineering manager, playback"]);
  });

  /**
   * The case the naive AND gets wrong, and the reason location-filter.ts
   * exists. United States, then Los Gatos under it, then Japan: an AND asks for
   * a posting that is in the US or Japan AND in Los Gatos, which is no Japanese
   * role at all -- the panel would show Japan ticked and list none of it.
   */
  it("widens by country and narrows by office at the same time", () => {
    const us = toggleCountry(EMPTY_QUERY, "US");
    const losGatos = toggleSite(us, "us-los-gatos", "US");
    const andJapan = toggleCountry(losGatos, "JP");

    expect(titles(losGatos)).toEqual([
      "Senior software engineer",
      "Staff software engineer",
    ]);
    expect(titles(andJapan)).toEqual([
      "Marketing manager",
      "Senior software engineer",
      "Staff software engineer",
    ]);
  });

  // Only reachable by hand-writing a URL, since ticking an office ticks its
  // country. It has to resolve to the office rather than to nothing.
  it("honours a site that arrives without its country", () => {
    const query: JobQuery = { ...EMPTY_QUERY, site: ["jp-tokyo"] };

    expect(titles(query)).toEqual(["Marketing manager"]);
  });

  it("ignores a site slug that is not in the catalog", () => {
    const query: JobQuery = { ...EMPTY_QUERY, country: ["US"], site: ["xx-atlantis"] };

    // The unknown slug narrows nothing, so the United States is still whole.
    expect(titles(query)).toHaveLength(4);
  });
});

describe("counting with a location facet open", () => {
  const query = toggleSite(toggleCountry(EMPTY_QUERY, "US"), "us-los-gatos", "US");

  // "How many roles are in Japan" must not be answered through a US office.
  it("drops the whole location filter when counting countries", () => {
    expect(titles(query, "country")).toHaveLength(5);
  });

  // The offices under a ticked country show their real totals while one of them
  // is selected -- that is what makes the other four clickable.
  it("keeps the country and drops the office when counting sites", () => {
    expect(titles(query, "site")).toEqual([
      "Brand designer",
      "Engineering manager, playback",
      "Senior software engineer",
      "Staff software engineer",
    ]);
  });
});
