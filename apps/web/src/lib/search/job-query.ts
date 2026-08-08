// The listing's entire state lives in the URL. This module is the only place
// that knows how it is spelled there, so a link, a facet toggle and the server
// render all agree by construction rather than by convention.

export type FacetKey = "team" | "workType" | "location";

export type JobQuery = {
  team: string[];
  workType: string[];
  location: string[];
  keywords: string[];
  page: number;
};

// Short keys, because a location value is already long enough to dominate the
// query string. `q` repeats, one per keyword chip.
export const PARAM: Record<FacetKey | "keywords" | "page", string> = {
  team: "team",
  workType: "type",
  location: "location",
  keywords: "q",
  page: "page",
};

export const FACET_KEYS: FacetKey[] = ["team", "workType", "location"];

export const EMPTY_QUERY: JobQuery = {
  team: [],
  workType: [],
  location: [],
  keywords: [],
  page: 1,
};

export type RawSearchParams = Record<string, string | string[] | undefined>;

// A repeated param arrives as an array, a single one as a string, an absent one
// as undefined -- all three collapse to a list here. Blank entries are dropped
// so `?team=` does not become a facet nobody can match, and the result is sorted
// and de-duplicated so two URLs selecting the same set are the same URL.
function readList(raw: string | string[] | undefined): string[] {
  const values = Array.isArray(raw) ? raw : [raw];
  const cleaned = values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);

  return [...new Set(cleaned)].sort((a, b) => a.localeCompare(b));
}

// Anything that is not a whole number at or above 1 is page 1. The upper bound
// belongs to the result count, not the URL, so clamping to the last page happens
// in paginate() where the total is known.
function readPage(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const page = Number(value);

  if (!Number.isInteger(page) || page < 1) {
    return 1;
  }

  return page;
}

export function parseJobQuery(params: RawSearchParams): JobQuery {
  return {
    team: readList(params[PARAM.team]),
    workType: readList(params[PARAM.workType]),
    location: readList(params[PARAM.location]),
    // Keywords keep their own casing for display in the chip; matching lowers
    // both sides. De-duplication is therefore case-sensitive here on purpose:
    // "Remote" and "remote" look different in a chip, so they stay two chips.
    keywords: readList(params[PARAM.keywords]),
    page: readPage(params[PARAM.page]),
  };
}

// The browser hands the same information as URLSearchParams rather than as the
// plain object Next gives the server. It is converted into that object and run
// through the SAME parse, because "what does this URL mean" has to have one
// answer -- a second reader here is how a back button lands on a state the
// server would have rendered differently.
export function readSearchParams(params: URLSearchParams): JobQuery {
  const raw: RawSearchParams = {};

  params.forEach((_value, key) => {
    raw[key] = params.getAll(key);
  });

  return parseJobQuery(raw);
}

// Written in a fixed order -- facets, then keywords, then page -- so the same
// state always produces byte-identical URLs and a copied link is stable.
export function toSearchParams(query: JobQuery): URLSearchParams {
  const params = new URLSearchParams();

  FACET_KEYS.forEach((key) => {
    query[key].forEach((value) => params.append(PARAM[key], value));
  });
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

export function isFiltered(query: JobQuery): boolean {
  return (
    FACET_KEYS.some((key) => query[key].length > 0) || query.keywords.length > 0
  );
}
