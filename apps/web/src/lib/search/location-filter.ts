import type { SiteCatalog } from "@/lib/jobs/board";
import type { JobSummary } from "@/lib/jobs/job-summary";
import { facetValues } from "@/lib/search/job-index";
import type { FacetKey, JobQuery } from "@/lib/search/job-query";

/**
 * Country and site are ONE filter asked at two depths, so they cannot be two
 * independent facets ANDed together.
 *
 * The naive version -- country ∈ selected AND site ∈ selected -- gets the
 * common case right and the interesting case wrong. Tick United States, then
 * Los Gatos under it, then Japan: the AND asks for a posting that is in the US
 * or Japan and also in Los Gatos, so every Japanese role disappears the moment
 * a US office is named. The panel shows Japan ticked and lists none of it.
 *
 * What the panel promises is a union of scopes, one per ticked country, each
 * narrowed by the offices ticked inside it:
 *
 *     the whole of Japan, OR Los Gatos in particular
 *
 * which is this rule:
 *
 *   a posting matches if it is in a ticked country that has no office ticked
 *   inside it, or if it is at a ticked office.
 *
 * A country with offices ticked contributes only those offices; a country with
 * none contributes all of itself; and the two clauses are ORed, so adding a
 * country always widens and adding an office always narrows the country it
 * sits in. Nothing else in the panel behaves differently, because nothing else
 * in the panel is nested.
 */

type LocationTest = (job: JobSummary) => boolean;

// Which countries still contribute whole, and which offices were named. A site
// whose country was never ticked -- only reachable by hand-writing a URL, since
// toggleSite ticks the country with it -- still contributes through the second
// clause, so the link resolves to the offices it names rather than to nothing.
function scopes(query: JobQuery, catalog: SiteCatalog) {
  const narrowed = new Set(
    query.site
      .map((slug) => catalog.bySlug.get(slug)?.country_code)
      .filter((code): code is string => code !== undefined),
  );

  return {
    whole: new Set(query.country.filter((code) => !narrowed.has(code))),
    sites: new Set(query.site),
  };
}

/**
 * The location predicate for one query, or null when there is nothing to test.
 *
 * `ignore` is the facet being counted with its own selection open, and it means
 * two different things here. Counting COUNTRIES drops the location filter
 * whole, offices included -- "how many roles are in Japan" must not be answered
 * through a US office that happens to be ticked. Counting SITES keeps the
 * country filter and drops only the office refinement, which is what makes the
 * offices under a ticked country show their real totals while one of them is
 * selected.
 */
export function locationMatcher(
  query: JobQuery,
  catalog: SiteCatalog,
  ignore?: FacetKey,
): LocationTest | null {
  if (ignore === "country") {
    return null;
  }

  const narrow = ignore !== "site";
  const { whole, sites } = scopes(narrow ? query : { ...query, site: [] }, catalog);

  if (whole.size === 0 && sites.size === 0) {
    return null;
  }

  return (job) =>
    facetValues(job, "country", catalog).some((code) => whole.has(code)) ||
    facetValues(job, "site", catalog).some((slug) => sites.has(slug));
}
