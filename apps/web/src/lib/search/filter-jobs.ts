import type { SiteCatalog } from "@/lib/jobs/board";
import type { JobSummary } from "@/lib/jobs/job-summary";
import { facetValues, keywordText } from "@/lib/search/job-index";
import type { FacetKey, JobQuery } from "@/lib/search/job-query";
import { locationMatcher } from "@/lib/search/location-filter";

// OR within a facet: picking Engineering and Marketing widens the result set,
// which is what a visitor ticking two boxes in one list means.
//
// Only the flat facets are handled this way. Country and site are nested, so
// they are one predicate built in location-filter.ts rather than two entries in
// this list -- see the comment there for why ANDing them is wrong.
const FLAT_KEYS: FacetKey[] = ["workType", "team"];

function matchesFacet(
  job: JobSummary,
  key: FacetKey,
  selected: Set<string>,
  catalog: SiteCatalog,
): boolean {
  return facetValues(job, key, catalog).some((value) => selected.has(value));
}

// AND across keywords: each chip narrows. Two chips that individually match
// nothing together are not a reason to widen back out.
function matchesKeywords(
  job: JobSummary,
  needles: string[],
  catalog: SiteCatalog,
): boolean {
  if (needles.length === 0) {
    return true;
  }

  return needles.every((needle) => keywordText(job, catalog).includes(needle));
}

/**
 * One query, compiled into a predicate, before any job is looked at.
 *
 * Everything here is a fact about the QUERY, so doing it per job was doing it
 * 481 times for one answer: lowercasing each keyword, asking whether each facet
 * has a selection at all, and scanning the selected values as an array. Hoisted,
 * a job test is a Set lookup per active facet and a substring scan per keyword
 * against a string the index already built.
 *
 * `ignore` drops one facet from the test. Facet counting needs "everything else
 * applied, this facet open", which is how an option can still show a count after
 * its own list has a selection in it.
 */
function jobMatcher(
  query: JobQuery,
  catalog: SiteCatalog,
  ignore?: FacetKey,
): (job: JobSummary) => boolean {
  const active = FLAT_KEYS.filter(
    (key) => key !== ignore && query[key].length > 0,
  ).map((key) => ({ key, selected: new Set(query[key]) }));

  const location = locationMatcher(query, catalog, ignore);

  // Blank needles are dropped rather than matched against: `includes("")` is
  // true for every job, so a half-typed keyword of one space would cost a scan
  // of the whole board to answer a question with no content in it.
  const needles = query.keywords
    .map((keyword) => keyword.trim().toLowerCase())
    .filter(Boolean);

  return (job) =>
    (!location || location(job)) &&
    active.every((facet) => matchesFacet(job, facet.key, facet.selected, catalog)) &&
    matchesKeywords(job, needles, catalog);
}

export function filterJobs(
  jobs: JobSummary[],
  query: JobQuery,
  catalog: SiteCatalog,
  ignore?: FacetKey,
): JobSummary[] {
  return jobs.filter(jobMatcher(query, catalog, ignore));
}
