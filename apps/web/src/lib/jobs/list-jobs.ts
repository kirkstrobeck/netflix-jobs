import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { JOBS_BOARD_TAG } from "@/lib/jobs/cache-tags";
import {
  SUMMARY_COLUMNS,
  toSummary,
  type JobRow,
  type JobSummary,
} from "@/lib/jobs/job-summary";
import { restGet } from "@/lib/supabase/rest";

// PostgREST caps a request at its own max-rows setting, so the ceiling is stated
// rather than assumed. 481 active postings today; 2000 leaves room to grow
// without a second round trip, and the board is crawled on a schedule so this
// number only has to outlast a cache period.
const MAX_ROWS = 2000;

// The whole active board in one cached entry.
//
// It is fetched entire, not per page, because the facet counts have to be exact:
// "Engineering (96)" is a count over every job matching the OTHER facets, which
// no single page of ten rows can know. Filtering, faceting and pagination then
// all run in memory over this one array. At 145KB that is cheaper than the four
// or five count queries the alternative needs, and it makes the whole listing a
// pure function of the URL.
//
// Ordered newest first at the database. The listing never re-sorts, so this is
// the order a visitor sees, and pagination is a slice of it.
//
// One cache entry answers every visitor, and it is replaced when the ingestor
// says so rather than when a clock runs out -- see the `jobs` profile in
// next.config.ts. At steady state this is one Supabase query per crawl, not per
// visitor and not per period.
//
// The nested join is flattened HERE, on the way into the cache, so the shape
// that crosses the cache boundary is the one every caller wants. Doing it after
// the read would re-walk 670 rows on every cache hit to produce the same array.
export async function listJobSummaries(): Promise<JobSummary[]> {
  "use cache";
  cacheLife("jobs");
  cacheTag(JOBS_BOARD_TAG);

  const rows = await restGet<JobRow[]>(
    `jobs?select=${SUMMARY_COLUMNS}&is_active=eq.true` +
      `&order=posting_date.desc.nullslast,position_id.desc&limit=${MAX_ROWS}`,
  );

  return rows.map(toSummary);
}
