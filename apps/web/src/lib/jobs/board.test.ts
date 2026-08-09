import { describe, expect, it } from "vitest";

import { openCountries, siteCatalog } from "@/lib/jobs/board";
import { BOARD, SITES, board, summary } from "@/lib/jobs/job-summary.fixture";

describe("siteCatalog", () => {
  it("indexes the sites by slug and collects their countries", () => {
    const catalog = siteCatalog(SITES);

    expect(catalog.bySlug.get("jp-tokyo")?.city).toBe("Tokyo");
    expect(catalog.countries.get("US")).toBe("United States");
    expect([...catalog.countries.keys()].sort()).toEqual(["CA", "JP", "US"]);
  });

  // deriveListing runs on every keystroke over a stable site array, so the
  // catalog is built once per site table rather than once per filter pass.
  it("is built once per site table", () => {
    expect(siteCatalog(SITES)).toBe(siteCatalog(SITES));
  });

  it("is a different catalog for a different site table", () => {
    expect(siteCatalog([...SITES])).not.toBe(siteCatalog(SITES));
  });
});

describe("openCountries", () => {
  /**
   * Not the countries in the site table. Madrid is a Netflix office with
   * nothing posted this week, so a visitor in Spain whose address was read
   * perfectly would land on an empty listing -- which reads as a broken board
   * rather than as a filter. Detection is checked against THIS.
   */
  it("is the countries with a role open, not the countries with an office", () => {
    // Canada is in the fixture catalog and has nothing posted against it.
    expect([...openCountries(BOARD)].sort()).toEqual(["JP", "US"]);
    expect(siteCatalog(SITES).countries.has("CA")).toBe(true);
  });

  // It stays a set of what is OPEN, so it answers correctly again the day
  // something is posted there.
  it("gains a country the moment something is posted in it", () => {
    const posted = board([...BOARD.jobs, summary({ sites: ["ca-vancouver"] })]);

    expect([...openCountries(posted)].sort()).toEqual(["CA", "JP", "US"]);
  });

  // The foreign key on job_locations makes this impossible from the database,
  // so it only fires if a board and a site table were paired across a crawl.
  // A posting quietly missing from a count is a better failure than a country
  // facet labelled "undefined".
  it("ignores a slug with no row in the catalog", () => {
    const stale = board([summary({ sites: ["xx-atlantis"] })]);

    expect(openCountries(stale).size).toBe(0);
  });

  it("is empty for a board with nothing on it", () => {
    expect(openCountries(board([])).size).toBe(0);
  });
});
