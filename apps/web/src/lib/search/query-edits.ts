import { FACET_KEYS, type FacetKey, type JobQuery } from "@/lib/search/job-query";
import type { SortOrder } from "@/lib/search/sort-order";

/**
 * Every ordinary edit to a query, and the two readings of how many edits have
 * been made.
 *
 * Kept apart from job-query.ts because that file answers a different question.
 * It is the SPELLING -- what each facet is called in the address bar, in what
 * order the params are written, which values are said by being left out -- and
 * a link only has to agree with it. Nothing here writes a URL. These take a
 * query and return another query, and the rules they enforce are about state,
 * not about text.
 *
 * geo-query.ts is the same seam one step further out: country and site are the
 * two edits that are not "toggle a value in a list", so they live in their own
 * file with the reason they are special.
 */

/**
 * Every edit here returns a new query and resets to page 1, because the page a
 * visitor was on says nothing about a differently filtered list -- being left
 * on page 7 of 2 is the classic version of this bug.
 */
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

// Page 1, like every edit above it. Reordering the list is not the same list
// scrolled to a different place -- page 3 of a nearest-first list holds entirely
// different roles from page 3 of a newest-first one, so staying on it would land
// the visitor somewhere they never chose.
export function withSort(query: JobQuery, sort: SortOrder): JobQuery {
  return { ...query, sort, page: 1 };
}

// How many separate answers the visitor has given. Every ticked box and every
// keyword chip counts once, which is what the filters toggle says out loud on a
// narrow screen -- a panel that is collapsed by default has to admit when it is
// hiding something that is changing the list. Sort is not in it: it reorders
// the list rather than narrowing it, and it has its own control on the line
// above the results.
export function appliedCount(query: JobQuery): number {
  const facets = FACET_KEYS.reduce((total, key) => total + query[key].length, 0);

  return facets + query.keywords.length;
}

export function isFiltered(query: JobQuery): boolean {
  return appliedCount(query) > 0;
}
