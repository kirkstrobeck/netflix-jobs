// The listing's entire state lives in the URL. This module is the only place
// that knows how it is spelled there, so a link, a facet toggle and the server
// render all agree by construction rather than by convention.

export type FacetKey = "team" | "workType" | "country" | "site";

export type JobQuery = {
  team: string[];
  workType: string[];
  /** ISO-3166-1 alpha-2 codes, upper case. */
  country: string[];
  /** public.locations slugs, always inside a selected country. */
  site: string[];
  /**
   * The visitor asked for EVERY country, and said so out loud.
   *
   * This is not the same as `country` being empty, and the difference is the
   * whole of "detection must never fight the user". An empty country list means
   * the URL has not answered the question, so the country detected from the
   * request is allowed to answer it. This flag means the question was answered
   * with "everywhere" -- by unticking the last country, or by following the
   * link under the facet -- and detection has to keep its hands off.
   *
   * It is spelled `?country=all` in the URL, so the distinction survives being
   * copied into a message and opened on someone else's machine.
   */
  everywhere: boolean;
  keywords: string[];
  page: number;
};

// Short keys, because a site slug is already long enough to dominate the query
// string. `q` repeats, one per keyword chip.
export const PARAM: Record<FacetKey | "keywords" | "page", string> = {
  team: "team",
  workType: "type",
  country: "country",
  site: "site",
  keywords: "q",
  page: "page",
};

/** The value of `?country=` that means "every country, and I mean it". */
export const EVERYWHERE = "all";

// Country before site, and both before the rest: the order here is the order
// the facets are counted in and the order the params are written in, and the
// country is the question the panel now leads with.
export const FACET_KEYS: FacetKey[] = ["country", "site", "workType", "team"];

export const EMPTY_QUERY: JobQuery = {
  team: [],
  workType: [],
  country: [],
  site: [],
  everywhere: false,
  keywords: [],
  page: 1,
};

// Written in a fixed order -- facets, then keywords, then page -- so the same
// state always produces byte-identical URLs and a copied link is stable.
export function toSearchParams(query: JobQuery): URLSearchParams {
  const params = new URLSearchParams();

  FACET_KEYS.forEach((key) => {
    query[key].forEach((value) => params.append(PARAM[key], value));
  });

  // Only when there is no country to name. `?country=all&country=US` would be
  // two answers to one question, and the specific one is the answer.
  if (query.everywhere && query.country.length === 0) {
    params.append(PARAM.country, EVERYWHERE);
  }

  query.keywords.forEach((value) => params.append(PARAM.keywords, value));

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

// Every mutation below returns a new query and resets to page 1, because the
// page a visitor was on says nothing about a differently filtered list -- being
// left on page 7 of 2 is the classic version of this bug.
export function toggleFacet(query: JobQuery, key: FacetKey, value: string): JobQuery {
  const selected = query[key];
  const next = selected.includes(value)
    ? selected.filter((entry) => entry !== value)
    : [...selected, value];

  return { ...query, [key]: [...next].sort((a, b) => a.localeCompare(b)), page: 1 };
}

export function addKeyword(query: JobQuery, keyword: string): JobQuery {
  const value = keyword.trim();

  if (!value || query.keywords.includes(value)) {
    return { ...query, page: 1 };
  }

  return {
    ...query,
    keywords: [...query.keywords, value].sort((a, b) => a.localeCompare(b)),
    page: 1,
  };
}

export function removeKeyword(query: JobQuery, keyword: string): JobQuery {
  return {
    ...query,
    keywords: query.keywords.filter((entry) => entry !== keyword),
    page: 1,
  };
}

export function withPage(query: JobQuery, page: number): JobQuery {
  return { ...query, page };
}

// `everywhere` is deliberately absent: it is the ABSENCE of a country filter,
// stated out loud. Counting it as a filter would put a "Clear all" link next to
// a listing that shows every role there is.
export function isFiltered(query: JobQuery): boolean {
  return (
    FACET_KEYS.some((key) => query[key].length > 0) || query.keywords.length > 0
  );
}
