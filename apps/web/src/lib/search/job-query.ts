import { DEFAULT_SORT, sortParam, type SortOrder } from "@/lib/search/sort-order";

// The listing's entire state lives in the URL. This module is the only place
// that knows how it is spelled there, so a link, a facet toggle and the server
// render all agree by construction rather than by convention.
//
// Spelling only. Editing a query -- ticking a facet, adding a keyword, paging,
// sorting -- is query-edits.ts, and the country pair is geo-query.ts. Reading a
// URL back is parse-query.ts.

// prettier-ignore
export type FacetKey =
  "team" | "workType" | "businessUnit" | "country" | "site" | "seniority";

export type JobQuery = {
  team: string[];
  workType: string[];
  /**
   * Streaming, Animation, Creations. Three values over 481 postings, which is
   * why it is a facet at all: it is the coarsest cut the board has, and the one
   * a role page can hand back as a link that means something.
   */
  businessUnit: string[];
  /** ISO-3166-1 alpha-2 codes, upper case. */
  country: string[];
  /** public.locations slugs, always inside a selected country. */
  site: string[];
  /**
   * Rungs, as slugs. The only facet whose values are not a column: it is read
   * off the title, so a posting that names no level offers none -- see
   * seniority.ts.
   */
  seniority: string[];
  keywords: string[];
  /**
   * How the results are ordered. NOT a facet -- it changes no result, only the
   * order -- and not something the server acts on: see sort-order.ts.
   *
   * It lives on the query anyway, and that is the point. Every mutation below
   * spreads the query, so a sorted view survives ticking a country, clearing a
   * keyword or paging, and a link carries the whole state rather than the last
   * thing that was clicked.
   */
  sort: SortOrder;
  page: number;
};

// Short keys, because a site slug is already long enough to dominate the query
// string. `q` repeats, one per keyword chip.
export const PARAM: Record<FacetKey | "keywords" | "sort" | "page", string> = {
  team: "team",
  workType: "type",
  businessUnit: "unit",
  country: "country",
  site: "site",
  // `level`, the shorter of the two words the facet answers to.
  seniority: "level",
  keywords: "q",
  sort: "sort",
  page: "page",
};

/**
 * "Every country, and I mean it" -- the answer, not a country.
 *
 * It is NOT a URL value any more. `?country=all` used to be how the URL said
 * that the question had been answered with "everywhere", which put a word in
 * the address bar that names no country and duplicates what a bare `/` already
 * shows. The answer now lives in the cookie, which is the only reader that has
 * to tell "chose everywhere" apart from "has not been asked" -- see
 * country-cookie.ts, and canonical-search.ts for how an old link is unspelled.
 *
 * It survives here because both of those still need one string for the idea,
 * and because parse-query has to keep dropping it from arriving URLs.
 */
export const EVERYWHERE = "all";

// The order the facets are counted in and the order the params are written in.
// Country before site because a site is a refinement of one, and the rest in a
// fixed order after them.
//
// It is deliberately NOT the panel's order and does not follow it. This is the
// spelling of a URL, and a URL that reshuffles itself because a sidebar was
// rearranged is a URL that stops matching the links people have already shared.
// The panel's order lives in facets-panel.tsx, where it is a design decision;
// this one only has to never change. Seniority is therefore APPENDED, not
// slotted in beside work type where it belongs by kind: every existing key
// keeps the position it had, so every link already shared still writes itself
// out byte for byte.
export const FACET_KEYS: FacetKey[] = [
  "country",
  "site",
  "workType",
  "team",
  "businessUnit",
  "seniority",
];

export const EMPTY_QUERY: JobQuery = {
  team: [],
  workType: [],
  businessUnit: [],
  country: [],
  site: [],
  seniority: [],
  keywords: [],
  sort: DEFAULT_SORT,
  page: 1,
};

// Written in a fixed order -- facets, then keywords, then sort, then page -- so
// the same state always produces byte-identical URLs and a copied link is
// stable.
export function toSearchParams(query: JobQuery): URLSearchParams {
  const params = new URLSearchParams();

  FACET_KEYS.forEach((key) => {
    query[key].forEach((value) => params.append(PARAM[key], value));
  });

  // Nothing is written for "every country". Everywhere is the ABSENCE of a
  // country filter, and a bare `/` is already the address of that -- so it is
  // spelled by leaving the param off, exactly as newest and page 1 are below.
  // What that costs is the difference between "chose everywhere" and "has not
  // been asked", which the URL can no longer carry; the cookie carries it
  // instead, and country-cookie.ts is where it is written down.

  query.keywords.forEach((value) => params.append(PARAM.keywords, value));

  // Newest is the default and the board's own order, so it is left out for the
  // same reason page 1 is: / and /?sort=new are one list and should not be two
  // URLs. Which also means an unsorted first load has nothing to say about sort
  // at all, and the server never sees the parameter. `near` is therefore the
  // only sort value this ever writes.
  if (query.sort !== DEFAULT_SORT) {
    params.set(PARAM.sort, sortParam(query.sort));
  }

  // Page 1 is the default, so it is left out. / and /?page=1 are the
  // same page and should not be two URLs.
  if (query.page > 1) {
    params.set(PARAM.page, String(query.page));
  }

  return params;
}

// The listing is the home page, so an unfiltered listing is "/" and every facet
// and page link hangs a query off it. /jobs is a permanent redirect here (see
// next.config.ts), which is what keeps already-shared faceted URLs working.
export function jobsHref(query: JobQuery, pathname = "/"): string {
  const params = toSearchParams(query).toString();

  if (!params) {
    return pathname;
  }

  return `${pathname}?${params}`;
}
