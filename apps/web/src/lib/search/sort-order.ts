/**
 * The two orders the listing can be read in, and the rule that only one of them
 * is a thing the server knows how to produce.
 *
 * Kept apart from job-query.ts because sort is not a facet. A facet narrows the
 * set and the server applies it; this reorders a set the server has already
 * decided, and NEAREST is not a server-side order at all -- it needs a position
 * the server never has and must never be sent. Having the type live here is
 * what lets deriveListing take the buckets as a separate argument rather than
 * finding them on the query and quietly using them wherever it runs.
 */

export type SortOrder = "newest" | "nearest";

/**
 * The default, and the reason it is spelled this way.
 *
 * Newest is what the board already is -- listJobSummaries orders by
 * posting_date desc at the database -- so an unsorted first load is not sorted
 * cheaply, it is not sorted at all. That is why `?sort=` is omitted from the URL
 * for it: / and /?sort=new would otherwise be two addresses for one list.
 */
export const DEFAULT_SORT: SortOrder = "newest";

/** What each order is called in the query string. Short, like the facet keys. */
const SPELLINGS: Record<string, SortOrder> = {
  new: "newest",
  near: "nearest",
};

const PARAMS: Record<SortOrder, string> = {
  newest: "new",
  nearest: "near",
};

/** Anything unrecognised is the default -- an old link is not an error page. */
export function parseSort(raw: string | string[] | undefined): SortOrder {
  const value = Array.isArray(raw) ? raw[0] : raw;

  return SPELLINGS[String(value).trim().toLowerCase()] ?? DEFAULT_SORT;
}

export function sortParam(sort: SortOrder): string {
  return PARAMS[sort];
}
