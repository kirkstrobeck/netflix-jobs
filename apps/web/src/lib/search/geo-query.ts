import type { JobQuery } from "@/lib/search/job-query";

/**
 * Where the country facet's rules live: what ticking a country does, what
 * ticking an office under it does, and when a country detected from the request
 * is allowed to apply.
 *
 * Kept apart from job-query.ts because these are the only mutations that are
 * not "toggle a value in a list". Country and site are one question asked at
 * two depths, so a change to either has to leave the pair coherent, and the
 * `everywhere` flag has to be written by the same hand that writes the country.
 */

const byName = (a: string, b: string) => a.localeCompare(b);

/** Has the URL answered the country question -- either way? */
export function countryChosen(query: JobQuery): boolean {
  return query.country.length > 0 || query.everywhere;
}

/**
 * Tick or untick a country. `sites` is every site slug that belongs to it.
 *
 * Unticking the last country does NOT return to "nothing selected", it selects
 * everywhere -- explicitly. Those two states look identical in a listing and
 * are opposite in intent: one is a visitor who has not said, and the other is a
 * visitor who just said "all of them" by clearing the box. Detection is allowed
 * to answer the first and must never touch the second, which is exactly what
 * "detection must never fight the user" means in code.
 *
 * A country's offices go with it. Leaving `site=us-los-gatos` behind after the
 * United States is unticked would leave the listing filtered by a control that
 * is no longer on screen -- the site options are only rendered under a ticked
 * country -- so it would be a filter with no way to clear it.
 */
export function toggleCountry(
  query: JobQuery,
  code: string,
  sites: string[] = [],
): JobQuery {
  const on = query.country.includes(code);
  const country = on
    ? query.country.filter((entry) => entry !== code)
    : [...query.country, code].sort(byName);
  const dropped = new Set(on ? sites : []);

  return {
    ...query,
    country,
    site: query.site.filter((slug) => !dropped.has(slug)),
    everywhere: country.length === 0,
    page: 1,
  };
}

/**
 * Tick or untick one office. Ticking it selects its country too.
 *
 * The country is the first-class choice and the site is a refinement inside it,
 * so a site can never be selected on its own: a link carrying only
 * `?site=jp-tokyo` still lands on a coherent Japan-then-Tokyo state rather than
 * on a site control nested under a country that is not ticked.
 */
export function toggleSite(query: JobQuery, slug: string, code: string): JobQuery {
  if (query.site.includes(slug)) {
    return { ...query, site: query.site.filter((entry) => entry !== slug), page: 1 };
  }

  return {
    ...query,
    country: query.country.includes(code)
      ? query.country
      : [...query.country, code].sort(byName),
    site: [...query.site, slug].sort(byName),
    everywhere: false,
    page: 1,
  };
}

/** Show every country, said out loud. What "Clear all" and the note link do. */
export function everyCountry(query: JobQuery): JobQuery {
  return { ...query, country: [], site: [], everywhere: true, page: 1 };
}

/**
 * WHERE THE DEFAULT IS APPLIED, AND WHY NOT HERE
 *
 * There used to be an applyCountryDefault beside countryChosen: it took a query
 * with no country and returned one with the detected country folded in, and
 * both the server render and the client's Back-button handler called it. That
 * is precisely the thing this codebase no longer does. Folding a country into a
 * query leaves a listing filtered by something its URL does not mention, and
 * two readers of the same URL who have to agree about it by calling the same
 * function.
 *
 * countryChosen survives because the QUESTION is still worth asking -- it is
 * what proxy.ts asks to decide whether a URL is owed a redirect. The answering
 * moved to lib/geo/country-redirect.ts, one hop earlier, where the answer can
 * be a new address instead of a hidden argument.
 */
