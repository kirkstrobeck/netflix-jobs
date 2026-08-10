// Parser output + curated seed -> the rows public.locations and
// public.job_locations want, and a report of everything that did not fit.
//
// The seed is the authority. A raw string the parser reads perfectly well but
// the seed does not cover has no coordinates, so it cannot become a location
// row; what it must NOT do is take the posting down with it. assignSites keeps
// the posting, links the sites it could place, and hands back the strings it
// could not so the caller can print them.

import { countryName } from './countries.ts';
import { parseLocation, splitLocationEntries } from './parse-location.ts';
import { SITE_SEED, type SeedSite } from './sites-seed.ts';

export type LocationRow = {
  slug: string;
  city: string | null;
  region: string | null;
  country_code: string;
  country: string;
  is_remote: boolean;
  /** Postgres point literal '(lng,lat)', or null -- as a pair -- when remote. */
  coords: string | null;
  display_name: string;
};

const BY_SLUG = new Map<string, SeedSite>();

for (const site of SITE_SEED) {
  for (const slug of [site.slug, ...(site.alsoKnownAs ?? [])]) {
    BY_SLUG.set(slug, site);
  }
}

function displayName(site: SeedSite, country: string): string {
  // 'Singapore, Singapore' says it twice; the board's own habit, not a fact.
  const city = site.city === country ? null : site.city;
  const place = [city, site.region, country].filter(Boolean).join(', ');

  return site.remote ? `Remote, ${place}` : place;
}

export function seedRows(): LocationRow[] {
  return SITE_SEED.map((site) => {
    const country = countryName(site.country);

    if (!country) {
      throw new Error(`seed site ${site.slug} has unknown country ${site.country}`);
    }

    return {
      slug: site.slug,
      city: site.city ?? null,
      region: site.region ?? null,
      country_code: site.country,
      country,
      is_remote: site.remote === true,
      // Written as one literal so the pair cannot be half-supplied. Postgres
      // point is (x, y) = (longitude, latitude).
      coords: site.coords ? `(${site.coords[1]},${site.coords[0]})` : null,
      display_name: displayName(site, country),
    };
  });
}

export type Assignment = {
  /** Seed-backed slugs, deduplicated, in first-seen order. */
  slugs: string[];
  /** Raw strings that parsed but are not in the seed, or did not parse. */
  unplaced: Array<{ raw: string; reason: string }>;
};

function reasonFor(raw: string): string {
  const parsed = parseLocation(raw);

  return parsed.ok ? `no seed entry for ${parsed.site.slug}` : parsed.reason;
}

// `locations` is the raw array off a posting; entries may themselves be the
// ' | '-joined scalar, so each one is split again before parsing.
export function assignSites(locations: string[]): Assignment {
  const slugs: string[] = [];
  const unplaced: Assignment['unplaced'] = [];

  for (const entry of locations.flatMap(splitLocationEntries)) {
    const parsed = parseLocation(entry);
    const seeded = parsed.ok ? BY_SLUG.get(parsed.site.slug) : undefined;

    if (!seeded) {
      unplaced.push({ raw: entry, reason: reasonFor(entry) });
      continue;
    }

    if (!slugs.includes(seeded.slug)) {
      slugs.push(seeded.slug);
    }
  }

  return { slugs, unplaced };
}

export type Unplaced = { raw: string; reason: string; jobs: number };

// One line per raw string the seed does not cover, with how many postings it
// costs a link, worst first. Empty is the healthy answer; anything in it is a
// line to add to lib/sites-seed.ts.
export function tallyUnplaced(perJob: string[][]): Unplaced[] {
  const tally = new Map<string, Unplaced>();

  for (const locations of perJob) {
    for (const miss of assignSites(locations).unplaced) {
      const seen = tally.get(miss.raw) ?? { ...miss, jobs: 0 };

      tally.set(miss.raw, { ...seen, jobs: seen.jobs + 1 });
    }
  }

  return [...tally.values()].sort((a, b) => b.jobs - a.jobs || a.raw.localeCompare(b.raw));
}
