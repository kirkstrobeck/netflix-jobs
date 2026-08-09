import type { JobSummary } from "@/lib/jobs/job-summary";
import type { Site } from "@/lib/jobs/site";

/**
 * The listing's whole world: every active posting, and the site table those
 * postings point at.
 *
 * The two travel together and are versioned together. A posting names its
 * locations by slug and nothing else, so jobs without sites cannot be filtered
 * by country and sites without jobs cannot be counted -- shipping them as one
 * value is what makes "the board" a thing that is either current or not, rather
 * than two fetches that can be one crawl apart.
 */
export type Board = {
  /** 36 rows today. Small enough to send whole; see lib/jobs/board-payload. */
  sites: Site[];
  jobs: JobSummary[];
};

export type SiteCatalog = {
  bySlug: Map<string, Site>;
  /** Country code -> display name, for labelling the country facet. */
  countries: Map<string, string>;
};

// Keyed on the ARRAY, not on the board object: deriveListing runs on every
// keystroke and the board object it is handed is stable, but so is the sites
// array inside it, and keying on the array means a board rebuilt around the
// same catalog still hits. Weak, so a replaced crawl takes its catalog with it.
const CATALOGS = new WeakMap<Site[], SiteCatalog>();

function build(sites: Site[]): SiteCatalog {
  const bySlug = new Map<string, Site>();
  const countries = new Map<string, string>();

  sites.forEach((site) => {
    bySlug.set(site.slug, site);
    countries.set(site.country_code, site.country);
  });

  return { bySlug, countries };
}

/**
 * The countries that have at least one role open right now.
 *
 * Not the countries in the site table: Madrid is a Netflix office with nothing
 * posted this week, so a visitor in Spain whose address was read perfectly
 * would land on an empty listing. That reads as a broken board rather than as a
 * filter, which is why detection is checked against this and not against the
 * catalog. It stays a set of what is OPEN, so it answers correctly again the
 * day something is posted there.
 */
export function openCountries(board: Board): Set<string> {
  const catalog = siteCatalog(board.sites);
  const open = new Set<string>();

  board.jobs.forEach((job) => {
    job.sites.forEach((slug) => {
      const site = catalog.bySlug.get(slug);

      if (site) {
        open.add(site.country_code);
      }
    });
  });

  return open;
}

/** The catalog as lookups, built once per site table. */
export function siteCatalog(sites: Site[]): SiteCatalog {
  const cached = CATALOGS.get(sites);

  if (cached) {
    return cached;
  }

  const built = build(sites);
  CATALOGS.set(sites, built);

  return built;
}
