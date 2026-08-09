import { siteCatalog, type Board } from "@/lib/jobs/board";
import type { JobSummary } from "@/lib/jobs/job-summary";
import type { SiteBuckets } from "@/lib/jobs/nearby-sites";
import { facetOptions, type FacetOption } from "@/lib/search/facet-counts";
import { filterJobs } from "@/lib/search/filter-jobs";
import { FACET_KEYS, type FacetKey, type JobQuery } from "@/lib/search/job-query";
import { pageSlice, paginate, type PageWindow } from "@/lib/search/paginate";
import { orderResults } from "@/lib/search/sort-jobs";

/** Everything the listing draws, for one query. */
export type ListingView = {
  /** The page's rows, already sliced. */
  jobs: JobSummary[];
  window: PageWindow;
  facets: Record<FacetKey, FacetOption[]>;
};

/**
 * Query plus board in, screen out. The ONE implementation of what the listing
 * shows, called on the server for the first paint and on the client for every
 * change after it.
 *
 * That is the whole point of it existing. The server render and the client
 * render answer the same question, and the moment they answer it with two
 * different bits of code they can disagree -- which shows up as the list
 * changing under you when the payload lands, or a shared link not matching what
 * the person who shared it saw. There is nothing to keep in step here because
 * there is only one of it.
 *
 * The country the server detected is NOT an input. Detection resolves to a
 * query before this is called (see applyCountryDefault), so what reaches here
 * is only ever "these filters" -- which is why the same call on the client, over
 * the same board, reproduces the server's screen exactly.
 *
 * `nearest` IS the deliberate exception, and it is an argument rather than
 * something read off the query for exactly that reason. Sorting by distance
 * needs the visitor's position, which the server does not have and must never
 * be sent, so the server calls this with two arguments and gets the newest-first
 * board every time -- for `?sort=near` too. The browser calls it with three
 * once the visitor has asked for Nearest and the rings have come back.
 *
 * That asymmetry is the only one. The country is resolved into the query before
 * anyone gets here, so it does not create a second; and because the sort is
 * applied AFTER filtering and BEFORE paginating, page 2 of a nearest list is the
 * second ring's worth of roles rather than the newest list re-sorted in place.
 */
export function deriveListing(
  board: Board,
  query: JobQuery,
  nearest: SiteBuckets | null = null,
): ListingView {
  const catalog = siteCatalog(board.sites);
  const matched = filterJobs(board.jobs, query, catalog);
  const results = orderResults(matched, query.sort, nearest);
  // paginate() clamps, so `window.page` is the page that actually exists -- the
  // one the pagination links have to be built from. `query.page` is only ever
  // what was asked for.
  const window = paginate(results.length, query.page);

  const facets = Object.fromEntries(
    FACET_KEYS.map((key) => [key, facetOptions(board.jobs, query, key, catalog)]),
  ) as Record<FacetKey, FacetOption[]>;

  return { jobs: pageSlice(results, window), window, facets };
}
