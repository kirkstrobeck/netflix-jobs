import {
  EMPTY_QUERY,
  EVERYWHERE,
  PARAM,
  type JobQuery,
} from "@/lib/search/job-query";
import { parseSort } from "@/lib/search/sort-order";

// Reading a URL. The other half -- what the state is and how it is written back
// out -- is job-query.ts; this is the side that has to cope with whatever a
// visitor, a crawler or an old link actually sends.

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

// `?country=us` and `?country=US` are one country. Codes are upper case
// everywhere else -- in the database, in the geo header, in the site slugs'
// meaning -- so the case is folded here rather than compared case-insensitively
// at every use.
function readCountries(raw: string | string[] | undefined): string[] {
  const values = readList(raw).map((value) => value.toUpperCase());

  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

const ALL = EVERYWHERE.toUpperCase();

export function parseJobQuery(params: RawSearchParams): JobQuery {
  const countries = readCountries(params[PARAM.country]);

  return {
    ...EMPTY_QUERY,
    team: readList(params[PARAM.team]),
    workType: readList(params[PARAM.workType]),
    businessUnit: readList(params[PARAM.businessUnit]),
    // 'ALL' is not a country code, so it can never collide with a real one, and
    // it is dropped from the list here rather than filtered downstream --
    // nothing should ever see it as a value to match postings against.
    //
    // Dropped, and nothing else: it used to also set an `everywhere` flag, so
    // that an old `?country=all` link meant "everywhere, and I mean it". The URL
    // no longer has a word for that, so what is left of such a link is a URL
    // that names no country -- which is the same as a bare `/`, and is answered
    // the same way. canonical-search.ts unspells it in the address bar.
    country: countries.filter((code) => code !== ALL),
    site: readList(params[PARAM.site]),
    // Keywords keep their own casing for display in the chip; matching lowers
    // both sides. De-duplication is therefore case-sensitive here on purpose:
    // "Remote" and "remote" look different in a chip, so they stay two chips.
    keywords: readList(params[PARAM.keywords]),
    // Read on the server too, and deliberately so. The server does not ACT on
    // it -- deriveListing is handed no buckets there, so every render is newest
    // -- but the value has to survive the round trip, or the first facet link
    // the visitor clicks would silently drop the sort they came in with. Read
    // here, written by toSearchParams, ignored in between.
    sort: parseSort(params[PARAM.sort]),
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
