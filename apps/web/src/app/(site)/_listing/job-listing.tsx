import { FacetsPanel } from "@/app/(site)/_listing/facets-panel";
import { Pagination } from "@/app/(site)/_listing/pagination";
import { ResultCount } from "@/app/(site)/_listing/result-count";
import { ResultList } from "@/app/(site)/_listing/result-list";
import { listJobSummaries } from "@/lib/jobs/list-jobs";
import { filterJobs } from "@/lib/search/filter-jobs";
import { parseJobQuery, type RawSearchParams } from "@/lib/search/job-query";
import { pageSlice, paginate } from "@/lib/search/paginate";

type JobListingProps = { searchParams: Promise<RawSearchParams> };

// Everything a visitor sees is a pure function of the URL: parse it, filter the
// cached board with it, cut the page out of the result. Nothing is fetched on
// the client, so a copied link renders the same server-side on someone else's
// machine as it does here.
export async function JobListing({ searchParams }: JobListingProps) {
  const query = parseJobQuery(await searchParams);
  const jobs = await listJobSummaries();

  const results = filterJobs(jobs, query);
  // paginate() clamps, so `window.page` is the page that actually exists -- the
  // one the pagination links have to be built from. `query.page` is only ever
  // what was asked for.
  const window = paginate(results.length, query.page);

  return (
    <div className="listing__body">
      <main className="listing__results">
        {/* Inside the results column, not above the body: it names this column,
            and being the column's first child is what puts it on the same line
            as "Filters" at the top of the other one.

            h2, not h1 -- the masthead owns the page's only h1. The "Netflix"
            eyebrow that used to sit here went with it: a brand kicker directly
            beneath a full-bleed Netflix-red masthead said the same thing twice. */}
        <header className="listing-hero">
          <h2 className="listing-title">Open roles</h2>
        </header>

        <ResultList jobs={pageSlice(results, window)} />

        <footer className="listing__foot">
          <ResultCount window={window} />
          <Pagination query={query} window={window} />
        </footer>
      </main>

      <FacetsPanel jobs={jobs} query={query} />
    </div>
  );
}
