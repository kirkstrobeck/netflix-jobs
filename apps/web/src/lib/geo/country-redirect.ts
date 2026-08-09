import { countryChosen } from "@/lib/search/geo-query";
import { PARAM } from "@/lib/search/job-query";
import { readSearchParams } from "@/lib/search/parse-query";

/**
 * Where a listing URL has to go before it is allowed to render.
 *
 * THE RULE: A FILTER THAT IS APPLIED IS IN THE URL
 *
 * There is no such thing as an applied-but-invisible facet. Detected from the
 * request, remembered from a cookie, or ticked by hand -- all three are the
 * same kind of thing, and all three are addresses. So a request that is about
 * to be answered with a country-filtered listing is answered with a redirect
 * instead, and the listing that finally renders is a pure function of the URL
 * in the address bar.
 *
 * That is why this returns a URL rather than a query: the caller is proxy.ts,
 * which runs BEFORE the render, so nothing has been sent to the browser and
 * nothing has to be corrected afterwards. A `replaceState` after hydration
 * would paint a bare `/` first and rewrite the location bar second, which is
 * the same wrong answer arriving later.
 *
 * IT IS A FIXED POINT
 *
 * Every target this returns carries `country`, so running it again on that
 * target hits `countryChosen` and returns null. There is no second hop and no
 * loop, and that holds for the case that looks like an exception: an empty
 * default returns null rather than a redirect, because "no country" is not a
 * filter and `/` is already the address of an unfiltered listing.
 *
 * WHICH IS ALSO HOW "EVERYWHERE" IS SPELLED NOW
 *
 * A visitor who unticks their last country is answering the question with
 * "everywhere", and the URL they land on is a bare `/` -- indistinguishable
 * from a URL that has never been asked. The difference is the cookie: theirs
 * says `all`, so countryDefault returns an empty list, so this returns null and
 * the bare `/` renders unfiltered and stays. A visitor with no cookie gets the
 * hop. The two states are told apart one hop before this, which is why nothing
 * about it is visible here.
 */
export function countryRedirect(
  search: URLSearchParams,
  countries: string[],
): string | null {
  // Nothing would be applied, so there is nothing the URL is failing to say.
  if (countries.length === 0) {
    return null;
  }

  // The URL already answered -- with a country, or with "all". A shared link is
  // authoritative over both the cookie and the address the request came from,
  // and this is the line that makes that true.
  if (countryChosen(readSearchParams(search))) {
    return null;
  }

  // The rest of the query is carried across UNTOUCHED rather than rebuilt from
  // the parsed state. jobsHref would spell the query canonically and drop
  // everything it does not model -- `?utm_source=`, `?src=test` -- and a
  // redirect that eats the campaign that sent someone here is a redirect that
  // costs money. Only `country` is rewritten, and only because the sole value
  // it can hold at this point is a blank one: `?country=` parses to no country
  // at all, so leaving it in would spell the answer `?country=&country=US`.
  const params = new URLSearchParams(search);

  params.delete(PARAM.country);
  countries.forEach((code) => params.append(PARAM.country, code));

  return `?${params.toString()}`;
}
