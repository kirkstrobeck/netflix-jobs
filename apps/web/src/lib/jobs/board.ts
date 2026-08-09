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
