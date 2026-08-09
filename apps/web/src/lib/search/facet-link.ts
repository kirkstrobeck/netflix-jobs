import type { Site } from "@/lib/jobs/site";
import { EMPTY_QUERY, jobsHref, type FacetKey } from "@/lib/search/job-query";

/**
 * The listing filtered by exactly one facet value, as an href.
 *
 * Built through jobsHref rather than by writing a query string, so these links
 * are spelled by the same function every facet toggle and every pager link is
 * spelled by. A hand-written `?type=Remote` would be right today and wrong the
 * first time a param is renamed.
 *
 * EMPTY_QUERY, not the visitor's current query: a role page has no listing
 * state to preserve -- it was arrived at from one particular list, or from
 * search, or from a link in a message, and guessing which would be guessing.
 * What the link promises is the value it names and nothing else.
 */
export function facetHref(key: FacetKey, value: string): string {
  return jobsHref({ ...EMPTY_QUERY, [key]: [value] });
}

/**
 * The listing filtered to one office, or to the country that office is alone
 * in.
 *
 * Location is the one facet asked at two depths, so a link to it has to pick
 * one. It picks the deepest depth the PANEL can actually draw: the offices
 * under a country are only rendered once there is more than one of them to
 * choose between (see worthNesting in country-facet.tsx), so a `?site=` on a
 * country with a single office would apply a filter whose only control is not
 * on screen -- an invisible filter, arrived at by link.
 *
 * Dropping the site there costs nothing, and that is not a compromise: if a
 * country holds exactly one office then every posting in that country is at it,
 * so the country filter and the office filter return the same rows. The link is
 * the same list either way; only one of the two spellings can be unticked.
 */
export function locationHref(site: Site, catalog: Site[]): string {
  const country = { ...EMPTY_QUERY, country: [site.country_code] };
  const siblings = catalog.filter(
    (entry) => entry.country_code === site.country_code,
  );

  if (siblings.length < 2) {
    return jobsHref(country);
  }

  return jobsHref({ ...country, site: [site.slug] });
}
