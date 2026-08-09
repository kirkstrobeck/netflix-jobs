import { formatLocations } from "@/lib/format/location";
import type { Site } from "@/lib/jobs/site";
import type { Job } from "@/lib/jobs/types";

/**
 * One place a posting is open, and whether the listing knows how to find it.
 *
 * `site` is null for the fallback below, and that null is the whole point of
 * the type: it is the difference between a place this page can hand to a link
 * and a place it can only print.
 */
export type Place = { label: string; site: Site | null };

/**
 * Where a posting is, in the vocabulary the listing filters on.
 *
 * The board stores locations twice over: as the raw crawl strings ('Los
 * Angeles,California,United States of America', and four other spellings of the
 * same office) and as slugs into public.locations. Only the slugs can be
 * filtered, so only the slugs can be linked, and the label comes off the site
 * record rather than off the raw string -- which means the words in the link
 * are the words on the facet it lands on.
 *
 * THE RAW STRINGS ARE THE FALLBACK, NOT THE SOURCE
 *
 * A posting with no rows in job_locations has a location that this app cannot
 * resolve to anywhere. Printing the crawl's own string is better than printing
 * nothing, and it arrives with site: null so nothing tries to link it. The
 * foreign key makes the reverse -- a slug with no site row -- impossible from
 * the database, so an unresolvable slug is dropped rather than guessed at.
 */
export function jobPlaces(job: Job, catalog: Site[]): Place[] {
  const bySlug = new Map(catalog.map((site) => [site.slug, site]));
  const resolved = job.sites
    .map((slug) => bySlug.get(slug))
    .filter((site): site is Site => site !== undefined)
    .map((site) => ({ label: site.display_name, site }));

  if (resolved.length > 0) {
    return resolved;
  }

  return formatLocations(job.locations, job.location).map((label) => ({
    label,
    site: null,
  }));
}

/** The places as one string, for somewhere that cannot hold a list. */
export function placeLine(places: Place[]): string {
  if (places.length === 0) {
    return "Location to be confirmed";
  }

  return places.map((place) => place.label).join(" · ");
}
