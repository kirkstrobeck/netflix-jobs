import type { JobSummary } from "@/lib/jobs/job-summary";
import { facetOptions, type FacetOption } from "@/lib/search/facet-counts";
import { filterJobs } from "@/lib/search/filter-jobs";
import { FACET_KEYS, type FacetKey, type JobQuery } from "@/lib/search/job-query";
import { pageSlice, paginate, type PageWindow } from "@/lib/search/paginate";

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
 */
export function deriveListing(jobs: JobSummary[], query: JobQuery): ListingView {
  const results = filterJobs(jobs, query);
  // paginate() clamps, so `window.page` is the page that actually exists -- the
  // one the pagination links have to be built from. `query.page` is only ever
  // what was asked for.
  const window = paginate(results.length, query.page);

  const facets = Object.fromEntries(
    FACET_KEYS.map((key) => [key, facetOptions(jobs, query, key)]),
  ) as Record<FacetKey, FacetOption[]>;

  return { jobs: pageSlice(results, window), window, facets };
}
