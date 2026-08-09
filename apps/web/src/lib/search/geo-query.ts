import type { JobQuery } from "@/lib/search/job-query";

/**
 * Where the country facet's rules live: what ticking a country does, what
 * ticking an office under it does, and when a country detected from the request
 * is allowed to apply.
 *
 * Kept apart from job-query.ts because these are the only mutations that are
 * not "toggle a value in a list". Country and site are one question asked at
 * two depths, so a change to either has to leave the pair coherent.
 */

const byName = (a: string, b: string) => a.localeCompare(b);

/**
 * Does the URL name a country?
 *
 * The only way a URL can answer the country question now. It used to have a
 * second answer -- `?country=all`, "everywhere and I mean it" -- and that word
 * is gone from the address bar, so a URL that names no country is a URL that
 * has not answered. Which is why the answer has to be remembered somewhere the
 * address bar is not: see country-cookie.ts.
 */
export function countryChosen(query: JobQuery): boolean {
  return query.country.length > 0;
}

/**
 * Tick or untick a country. `sites` is every site slug that belongs to it.
 *
 * Unticking the last country means everywhere, EXPLICITLY -- and the explicit
 * part is no longer visible here, because it is not in the query any more.
 * "Everywhere" and "has not been asked" produce the same URL, a bare `/`, and
 * are opposite in intent: detection is allowed to answer the second and must
 * never touch the first. The cookie is what tells them apart, and every control
 * that calls this goes through useCountryChoice, which writes it. Unticking the
 * last country here is what writes "everywhere" there.
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
    page: 1,
  };
}

/* WHERE everyCountry WENT
 *
 * It returned a query with `everywhere: true` on it, and "Clear all" used it so
 * that clearing would spell `?country=all` rather than `/`. There is no flag to
 * set any more, so what it returned is EMPTY_QUERY, and "Clear all" says so
 * directly. The part that mattered -- that clearing is an ANSWER and must not
 * be re-detected on the next load -- moved to the cookie, which "Clear all"
 * writes because it navigates through useCountryChoice.
 */

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
