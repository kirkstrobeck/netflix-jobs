import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { JOBS_BOARD_TAG, jobTag } from "@/lib/jobs/cache-tags";
import { isJobId, type Job } from "@/lib/jobs/types";
import { restGet } from "@/lib/supabase/rest";

const COLUMNS = [
  "position_id",
  "display_job_id",
  "title",
  "department",
  "business_unit",
  "team",
  "location",
  "locations",
  "work_location_option",
  "work_type",
  "description_html",
  "description_text",
  "apply_url",
  "canonical_url",
  "posting_date",
  "source_created_at",
].join(",");

// Cached so the page is prerenderable: with `cacheComponents`, an uncached await
// here would make the whole route block on the request instead of streaming a
// static shell. The entry outlives any crawl schedule because the crawl is what
// ends it -- see the `jobs` profile in next.config.ts.
//
// Lookup goes through the job_by_display_id RPC rather than a column filter
// because PostgREST cannot express `upper(col) = upper($1)`. See
// supabase/migrations/20260805120000_job_display_id_lookup.sql. The match is
// case-insensitive at the database, so this never has to trust the caller's
// casing -- which matters because getJob is also reached by the prerender, not
// only by requests the proxy has already canonicalized.
export async function getJob(jobId: string): Promise<Job | null> {
  "use cache";
  cacheLife("jobs");
  // Two tags, deliberately. The board tag means a finished crawl flushes every
  // job page without the ingestor having to name 481 ids; the per-job tag means
  // one corrected posting can be flushed on its own, leaving the other 480
  // entries warm.
  cacheTag(JOBS_BOARD_TAG, jobTag(jobId));

  if (!isJobId(jobId)) {
    return null;
  }

  const rows = await restGet<Job[]>(
    `rpc/job_by_display_id?p_display_id=${encodeURIComponent(jobId)}&select=${COLUMNS}&limit=1`,
  );

  return rows[0] ?? null;
}
