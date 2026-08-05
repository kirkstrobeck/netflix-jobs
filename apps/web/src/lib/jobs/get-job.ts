import "server-only";

import { cacheLife, cacheTag } from "next/cache";

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
].join(",");

// Cached so the page is prerenderable: with `cacheComponents`, an uncached await
// here would make the whole route block on the request instead of streaming a
// static shell. The board is crawled on a schedule, so hours-old data is correct.
//
// Lookup goes through the job_by_display_id RPC rather than a column filter
// because PostgREST cannot express `upper(col) = upper($1)`. See
// supabase/migrations/20260805120000_job_display_id_lookup.sql. The match is
// case-insensitive at the database, so this never has to trust the caller's
// casing -- which matters because getJob is also reached by the prerender, not
// only by requests the proxy has already canonicalized.
export async function getJob(jobId: string): Promise<Job | null> {
  "use cache";
  cacheLife("hours");
  // Tagged on the canonical uppercase form so one revalidateTag flushes every
  // casing of the same job rather than leaving stale mixed-case entries behind.
  cacheTag("jobs", `job:${jobId.toUpperCase()}`);

  if (!isJobId(jobId)) {
    return null;
  }

  const rows = await restGet<Job[]>(
    `rpc/job_by_display_id?p_display_id=${encodeURIComponent(jobId)}&select=${COLUMNS}&limit=1`,
  );

  return rows[0] ?? null;
}
